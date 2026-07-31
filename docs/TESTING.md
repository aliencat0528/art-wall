# 測試

作品牆是無後端的純前端 SPA，測試分兩層：**邏輯層走單元測試**、**瀏覽器行為走 E2E**。
兩者的分工不是隨意切的，而是照 `.claude/knowledge/browser-automation-cost.md` 的原則
——「AI 瀏覽器是發現工具，不是回歸工具；已知該長怎樣的東西固化成真測試」。

## 指令

```bash
npm run test         # 單元測試（Vitest，單次跑完）
npm run test:watch   # 單元測試，監看模式
npm run coverage     # 單元測試 + 覆蓋率報告（coverage/index.html）
npm run test:e2e     # E2E（Playwright，會自動 build 並起 preview）
```

E2E 首次執行前要裝瀏覽器：`npx playwright install chromium`。

## 分層與範圍

| 層 | 工具 | 測什麼 | 檔案 |
|----|------|--------|------|
| 單元 | Vitest + jsdom | composables 與 utils 的**邏輯**：資料合併、CRUD、篩選、網址狀態、IndexedDB wrapper、暗場配色（`accentDark` 對比度、`counterAccent` 色差、六類 accent 必須有彩） | `src/**/*.spec.ts` |
| E2E | Playwright（chromium） | 真實瀏覽器的**流程與持久化**：分類切換、詳情開關、深連結、上傳→reload→圖片還在 | `e2e/*.spec.js` |

**為什麼有些東西只在 E2E 測**：

- **圖片處理（`utils/image.ts`）** 走 canvas，jsdom 沒有實作，只有真實瀏覽器測得到。
  上傳流程在 `e2e/editor.spec.js` 驗。
- **IndexedDB 存 Blob 的完整往返**：單元測試用 `fake-indexeddb`，但它的 structured clone
  不認得 jsdom 的 Blob（存進去讀回來變空物件）。所以 `idb.spec.ts` 只用 `Uint8Array`
  驗 wrapper 的 key/覆寫/刪除邏輯，真正的 Blob 往返交給 E2E 的「reload 後圖片還在」。

**上傳流程要等處理完再往下走**：`processImage`（canvas 縮圖 + `toBlob`）是非同步的，
本機實測從按下「新增作品」到寫進 localStorage／IndexedDB 要 1.5～2 秒，期間面板顯示「處理中⋯」。
測試若在這段期間 `reload()`，那筆作品會整個消失——**看起來像持久化壞掉，其實是測試搶跑**。
規則：驗持久化前，先等使用者看得到的結果出現（作品上牆），不要等固定秒數。

**單元測試目前不涵蓋**（有意）：`useAppearance` / `useMediaQuery` / `useSettings` /
`usePointerParallax` 偏 DOM 與媒體查詢，行為由 E2E 的整頁流程間接覆蓋；
`useLibrary.replaceImage`（換圖）尚無專測，是已知缺口。

**長廊景深與互動（MR-014）的驗證方式**：`--focus`／偏轉／光池強弱是視覺量值，
斷言具體數字等於把實作綁進測試，故不寫單元測試；**會壞掉的是「作品點不開」這一類行為**，
由 E2E 既有的「點作品開詳情」把關（拖曳曾因 `setPointerCapture` 吃掉 click，就是這條抓到的）。

**詳情頁 pan/zoom（MR-015）分兩層測**：夾制與錨點是純數學，`useImageZoom.spec.ts` 直接測
匯出的純函式（jsdom 沒有版面，`offsetWidth` 一律 0，在單元層測 DOM 量測等於測假的）；
手勢串起來的行為（雙擊放大、拖得動、拖曳不會誤關詳情、切件回到 fit）由 E2E 把關。
**雙指縮放沒有自動化測試**——Playwright 專案只設 chromium 桌機、無觸控模擬，
這條目前靠手動驗，是已知缺口。

**疊印視覺（MR-016）同樣只測行為不測長相**：色圓位置、模糊半徑、顆粒濃度都是視覺量值。
`e2e/atmosphere.spec.js` 測三件會真的壞掉的事——殘像跟得上游標且快慢兩顆不重合、
停下來會散掉、拖曳推開套色錯位且放手彈回；純數學（`lerp`／`misregFor`）在 `utils/motion.spec.ts`。
> **rAF 只在分頁可見時才跑**：用 AI 瀏覽器手動驗殘像會看到「完全沒動」，那是分頁沒聚焦、
> `requestAnimationFrame` 被節流，不是壞掉。要驗這一類東西就走 Playwright。

> **E2E 超時要先懷疑資源競爭**：光氛層有常駐動畫，若同時開著 dev server 與另一個
> 開著本站的瀏覽器分頁，整套測試會從約 13 秒拖到 1 分鐘以上並隨機超時。
> 先關掉再重跑，不要急著改測試。
>
> **本機 worker 已釘在 2**（MR-017）。原本是預設值（依 CPU 核心數，實測開 4 個），
> 測試數從 23 加到 34 之後，上面那個現象變成**穩定重現**——`atmosphere.spec.js`
> 的兩個 rAF 時序測試在整套跑時必紅、單獨跑必綠。受測程式碼沒有問題，
> 是同時有數個分頁在跑常駐動畫把 rAF 節流掉了。2 個 worker 下總時長約 33 秒。

**走廊模式（MR-017）測的就是用戶指定的三條硬要求**——不卡住、不跑版、作品點得開。
`e2e/hall.spec.js` 11 個測試涵蓋：切得進去／深連結、相機真的推進且到底停住、
連按不掉步、**不撐出水平捲軸**、**走動後仍點得開作品**、切回牆面收乾淨且篩選還在、
方向鍵不必先點畫面、減少動態與窄螢幕不提供入口。透視好不好看不測（視覺量值），
純幾何在 `src/utils/hall.spec.ts`。

> **走廊的點擊測試要指名 `data-index`，不能用 `.first()`**：可見窗口會保留相機後方
> 一件，它在畫面上等於不存在，但 `boundingBox()` 仍算得出來，點下去只會打到底下的容器。
> 開發時就是這樣抓到「viewport 攔截 pointer events」——`.hall__viewport` 是滿版元素，
> 整條 3D 脈絡都要 `pointer-events: none`，只有作品那層收回來。

## 測試流程報告（四段式）

> 格式定義見規則層 `.claude/specs/testing.md`，此處為本專案的具體填法。

1. **環境準備 (Setup)**：`npm ci`；E2E 另需 `npx playwright install chromium`。
   本機 Node 18，CI Node 20。
2. **執行步驟 (Execution)**：`npm run lint && npm run test && npm run build && npm run test:e2e`。
3. **預期結果 (Expected)**：lint 零警告；單元 104 tests 全過；build 產出 `dist/`；E2E 34 tests 全過。
4. **驗證方式 (Verification)**：`npm run coverage` 看 composables/utils 覆蓋率；
   E2E 失敗時看 `playwright-report/`（CI 會上傳成 artifact）。

## 版本鎖（重要）

本機 Node 為 **18.12**，以下都因此釘在能相容 Node 18 的版本，升 Node 20 之前**不要升**：

| 套件 | 釘的版本 | 原因 |
|------|---------|------|
| `vitest` / `@vitest/coverage-v8` | `~3.2` | 4.x 要求 Node `^20 \|\| ^22 \|\| >=24` |
| jsdom（而非 happy-dom） | — | happy-dom 修掉 VM context escape（GHSA-37j7-fg3j-429f）的版本要 Node ≥20 |
| Playwright 設定與 E2E 測試檔 | 用 `.js` 不用 `.ts` | Node 18 + `"type":"module"` 下 Playwright 的 TS loader 不生效（需 Node 20 的 `module.register`） |

詳見 `prepare.md` 的 MR-013。這串限制與 ESLint 釘在 v9（MR-003）同源——
升 Node 20 可一次解掉，但那是另一個決策。

## CI

- **`.github/workflows/ci.yml`**（PR 觸發）：lint → 單元 → build → E2E，完整門檻。
- **`.github/workflows/deploy.yml`**（push main 觸發）：lint → 單元 → build → 發佈 GitHub Pages。
  E2E 不進部署路徑，避免每次發佈都下載瀏覽器；PR 已擋過一輪。
