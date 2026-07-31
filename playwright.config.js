import { defineConfig, devices } from '@playwright/test'

// 用 .js 而非 .ts：本機 Node 18.12 + "type":"module" 下，Playwright 無法透過
// Node 的 ESM loader 載入 .ts 設定檔（ERR_UNKNOWN_FILE_EXTENSION）。
// E2E 測試檔同樣是 .js，理由相同（見 MR-013 與 docs/TESTING.md 的版本鎖）。

const PORT = 4173
// vite base 是 /art-wall/，preview 也吃這個前綴，網址少一層就會 404
const BASE_URL = `http://localhost:${PORT}/art-wall/`

/**
 * E2E 跑的是 production build（npm run preview），不是 dev server——
 * 要驗的東西包含 base 路徑與資產載入，dev server 蓋不到那層。
 *
 * 只裝 chromium：這裡的目的是回歸驗證既有流程，不是跨瀏覽器相容性矩陣。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /**
   * 本機也釘 2 個 worker（原本是 undefined＝依 CPU 核心數，實測開 4 個）。
   *
   * 理由是本套件有一批**吃 `requestAnimationFrame` 時序**的測試（游標殘像的追隨
   * 與衰減、拖曳的套色錯位衰減）。worker 一多，同時有數個分頁在跑常駐動畫，
   * rAF 被節流，這些測試就開始隨機失敗——**受測程式碼沒有問題**，
   * 單獨跑 `atmosphere.spec.js` 一律全過。MR-016 已記過同一個現象
   * （「E2E 超時要先懷疑資源競爭」），MR-017 把測試數從 23 加到 34 之後它變成穩定重現。
   *
   * 2 個 worker 下總時長約 50 秒，換到的是不會誤報的紅燈。
   */
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'list' : 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
