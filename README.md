給任意創作者用的線上作品牆：資料驅動、分類可編輯、可策展成展覽，並可在瀏覽器內編輯與上傳。

![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

# Art Wall - 作品牆

線上展場：<https://aliencat0528.github.io/art-wall/>

## 功能特色

- **開場序列** — 3.4 秒幾何動畫後進站。Skip 常駐、只播一次，系統設定為減少動態時不播
- **暗場光氛展場** — 底色近黑，亮度全部由光源給：頂部光暈、體積光柱、浮塵、低處霧氣、定時掃描光與暗角。光打在作品上、不打在背景上，作品圖面不覆蓋任何色層
- **水平長廊＋景深** — 寬螢幕以固定軌道高度橫向展開，作品上中下交叉懸掛並依「距中心距離」偏轉、退遠、變暗，走到誰面前誰就轉正、亮起來；兩端漸隱成走道盡頭。可拖曳走動、方向鍵逐件停留、Home／End 到頭尾，右下角標示第幾件；窄螢幕自動降級為網格
- **版位鎖定** — 正方 1:1／橫幅 3:2／直幅 2:3／影片 16:9 四種版位，比例由 CSS 鎖死，圖片不會撐破版面
- **分類換光色** — 內建壓克力、水彩、書法、立體、動畫、新媒體六類，也可在編輯面板新增自訂分類（選名稱／顏色／紋理，暗場強調色自動推導並驗對比度）。切換時換的是**光的顏色**——光暈、聚光、光池、疊印框與站頭一起換調子，作品圖面本身不上色
- **展覽策展** — 把作品編成有序動線加前言；站頭出現「依媒材／依展覽」切換，沒有建立展覽時主頁面維持原樣
- **作品詳情** — 中圖、媒材標籤、敘述、角色與貢獻、外部連結、年份。Esc 關閉、左右鍵換件、焦點鎖定
- **瀏覽器內編輯** — 站台資訊、上傳作品、編修敘述、隱藏內建作品、管理分類與展覽、匯出匯入 JSON
- **可分享網址** — `?c=<分類>`、`?w=<作品>`、`?m=ex&ex=<展覽>` 皆為深連結，開詳情走 pushState，上一頁＝關閉

## 快速開始

```bash
npm install
npm run dev
# 預期：VITE v5 ready，開 http://localhost:5173/art-wall/
```

網址帶 `/art-wall/` 是因為站台部署在 GitHub Pages 的專案頁下，`base` 設為同一個值。

想重看開場動畫：`http://localhost:5173/art-wall/?intro=1`

## 使用方式

### 換上自己的作品

編輯 `src/data/works.ts`，把 `SEEDS` 換成你的作品。目前圖片是程式產生的幾何佔位圖
（`src/utils/placeholder.ts`），換真圖時每件作品需要：

```typescript
{
  id: 'acr-001',
  title: '午後的重量',
  category: 'acrylic',        // 見 src/data/categories.ts
  media: ['壓克力顏料', '亞麻布'],
  year: '2025',
  aspect: 'portrait',         // square | landscape | portrait | video
  description: '⋯⋯',
  role: '創作、裝裱',
  links: [{ label: '完整系列', url: 'https://example.com' }],
}
```

換真圖時把 `src` 指向原圖、`thumb` 指向長邊 800px 的壓縮版（牆面永遠不載原圖），
並填上 `width` / `height` 實際像素以避免版面跳動。

### 在瀏覽器內編輯

頁尾「編輯內容」開四個分頁：站台資訊、作品、分類、展覽。上傳的圖會自動壓成牆面縮圖（800px）
與詳情用圖（1800px），並依實際比例帶入版位。自訂分類與展覽都與作品一起匯出。

> **限制**：編輯只存在該瀏覽器（localStorage 與 IndexedDB），**沒有後端**。
> 訪客看到的仍是 `src/data/works.ts` 的內容。要讓改動對外生效：
> 匯出 JSON → 寫進 `src/data/works.ts` → PR merge 進 `main` → 自動重新部署。
> 完整步驟見 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#3-發佈內容變更)。

## 專案結構

```
src/
├── components/         # 站頭、光氛層、長廊、卡片、詳情、開場、編輯面板
├── composables/        # 作品資料層、篩選與網址同步、外觀套用、游標視差、媒體查詢
├── data/               # 作品、分類主題
├── styles/             # 全站 token 與基礎樣式
├── types/              # 型別定義
└── utils/              # 佔位圖產生、圖片壓縮、IndexedDB
```

模組職責、資料流、主題系統與長廊景深的實作見 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 部署

部署在 GitHub Pages，來源為 GitHub Actions。**PR merge 進 `main` 即自動發佈**，
`.github/workflows/deploy.yml` 會先跑 lint 與型別檢查，沒過就不部署。

一次性設定、發佈內容變更的完整步驟與故障排除見 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)。

## 測試

```bash
npm run lint     # ESLint --max-warnings 0
npm run test     # 單元測試（Vitest：composables / utils）
npm run build    # vue-tsc 型別檢查 + vite build
npm run test:e2e # E2E（Playwright，僅 chromium）
```

**Commit 前必做**：`lint` + `test` + `build` 皆須通過。分層與範圍見 [`docs/TESTING.md`](docs/TESTING.md)。

> **Node 18 版本鎖**：ESLint 釘 v9、Vitest 釘 ~3.2、用 jsdom、Playwright 設定與 E2E 用 `.js`
> ——三者都因本機 Node 18 而定，升 Node 20 前不要動（見 `prepare.md` MR-003 / MR-013）。

## 技術棧

- **框架**：Vue 3 + TypeScript
- **建置**：Vite
- **樣式**：CSS Variables，無 UI 框架、無動畫函式庫
- **儲存**：localStorage（`artwall.library.v2` 單一 document + 站台設定）+ IndexedDB（圖片 blob）
- **檢查**：ESLint 9 + typescript-eslint + eslint-plugin-vue
- **測試**：Vitest + jsdom（單元）、Playwright（E2E）

## 版本歷史

### v2.3.0 (2026-07-30)

- **暗場光氛成為唯一定調** — 六層光學（主光暈／體積光／浮塵／霧氣／掃描光／暗角）＋作品聚光、光池、雙色錯位疊印框；整體背景四選一移除，站台不再切換底色（MR-014，Phase F）
- **長廊景深與互動** — `--focus` 驅動牆面偏轉／退遠／變暗與光的強弱；拖曳走動、方向鍵逐件停留、走道兩端漸隱、右下角件數標示
- **書法／立體改用材料色** — 墨與石膏灰在暗場發不出光，改為印泥朱紅 `#b7332a`／陶土赭 `#a9713d`
- **移除原型實驗室** — `?lab=1` 的六方案比較連同 `src/prototypes/` 整包刪除，方案 F 落地為主站

### v2.2.0 (2026-07-24)

- **分類可編輯** — 編輯面板新增「分類」分頁，可自訂名稱／代號／顏色／紋理，`accentDark` 由 accent 自動推導並驗暗底對比度（Phase E，MR-012）
- **展覽策展層** — 作品可編成有序動線加前言，站頭「依媒材／依展覽」切換、`?m=ex` 深連結（Phase E，MR-012）
- **持久層收成單一 document** — `artwall.library.v2`（帶 `schemaVersion`），開站自動由舊 `works/overrides/hidden.v1` 三 key 遷移，不刪舊 key 可回滾
- **EditorPanel 拆為分頁式** — 站台／作品／分類／展覽四頁

### v2.1.0 (2026-07-22)

- **上線 GitHub Pages** — Actions workflow 自動建置與部署，lint 與型別檢查沒過就不發佈（MR-010）
- **repo 更名為 `art-wall`** — 網址從 `maze-portfolio` 改為 `art-wall`，`vite base` 同步調整
- **新增** `docs/DEPLOYMENT.md`，含發佈內容變更的完整路徑

### v2.0.0 (2026-07-21)

- **重構為作品牆** — 迷宮履歷全數移除，改為資料驅動的作品牆＋詳情頁（MR-008，← D-003）
- **分類切換取代顏色切換** — 六分類各有強調色、動效曲線、卡片邊緣與紋理；強調色貫穿站頭、卡片外框、進度條與頁尾
- **整體背景切換** — 四種背景，暗色底改用各分類的 `accentDark`
- **瀏覽器內編輯與上傳** — IndexedDB 存圖、localStorage 存文字，可匯出匯入 JSON（MR-009）
- **移除** — `nes.css` 依賴、CRT 樣式、六房間與迷宮邏輯

### v1.1.0 (2026-07-17)

- 迷宮層重寫為地牢格子圖、琥珀單色終端機調色盤、技術債清理（MR-002／MR-005／MR-003）

### v1.0.0 (2025-01-27)

- 初始版本：迷宮探索式履歷框架、六個主題房間、終端機風格與 CRT 效果

## 授權

MIT License
