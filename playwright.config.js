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
  workers: process.env.CI ? 1 : undefined,
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
