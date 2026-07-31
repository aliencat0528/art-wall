import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/**
 * 編輯流程的回歸驗證，重點在**持久化**：
 * 圖片走 IndexedDB、文字走 localStorage，reload 後兩者都要接得回來。
 *
 * 這段只有真實瀏覽器測得到——單元測試那邊 fake-indexeddb 的 structured clone
 * 不認得 Blob（見 src/utils/idb.spec.ts 的說明）。
 *
 * 用 .js 而非 .ts：本機 Node 18.12 下 Playwright 的 TS loader 不生效。見 MR-013。
 */
const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/sample.png')
const TITLE = '端到端測試作品'

async function openPanel(page, tab) {
  await page.getByRole('button', { name: '編輯內容' }).click()
  const panel = page.getByRole('dialog', { name: '編輯內容' })
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: tab, exact: true }).click()
  return panel
}

const openWorksTab = (page) => openPanel(page, '作品')
// 匯出／匯入／還原內建作品在「站台」分頁，不在「作品」分頁
const openSiteTab = (page) => openPanel(page, '站台')

async function createWork(page, title = TITLE) {
  const panel = await openWorksTab(page)
  await panel.getByRole('button', { name: '＋ 新增作品' }).click()

  await panel.getByLabel('作品圖片').setInputFiles(FIXTURE)
  await panel.getByLabel('標題').fill(title)
  await panel.getByLabel('年份').fill('2026')
  await panel.getByLabel('媒材').fill('壓克力顏料、麻布')
  await panel.getByLabel('作品敘述').fill('由 Playwright 建立的測試資料')
  await panel.getByLabel('角色／我的貢獻').fill('創作')

  await panel.getByRole('button', { name: '新增作品', exact: true }).click()
  return panel
}

test('新增作品後立刻出現在牆上，且排在最前面', async ({ page }) => {
  await page.goto('./?intro=0')
  const panel = await createWork(page)

  await panel.getByRole('button', { name: '關閉編輯面板' }).click()

  const cards = page.getByRole('button', { name: /^開啟作品：/ })
  await expect(cards.first()).toHaveAccessibleName(`開啟作品：${TITLE}`)
})

test('reload 之後作品還在，圖片也接得回來', async ({ page }) => {
  await page.goto('./?intro=0')
  const panel = await createWork(page)
  await panel.getByRole('button', { name: '關閉編輯面板' }).click()

  // 先等作品真的上牆再 reload。圖片處理（canvas 縮圖 + toBlob）是非同步的，
  // 本機實測要 1.5～2 秒才寫進 localStorage／IndexedDB；不等就 reload 會把
  // 還在處理中的那一筆整個丟掉，測起來像「持久化壞了」，其實是這條測試自己搶跑。
  // 這裡等的是使用者看得到的結果，不是內部狀態——要驗的是「存得住」而不是「多快存完」。
  await expect(page.getByRole('button', { name: `開啟作品：${TITLE}` })).toBeVisible()

  await page.reload()

  const card = page.getByRole('button', { name: `開啟作品：${TITLE}` })
  await expect(card).toBeVisible()

  // 圖片來自 IndexedDB 的 blob，naturalWidth 為 0 代表沒接回來。
  // reload 後要先讀 DB、產 object URL、再解碼，平行跑測試時這條鏈較慢，放寬到 15s
  const image = card.locator('.card__image')
  await expect
    .poll(() => image.evaluate((img) => img.naturalWidth), { timeout: 15_000 })
    .toBeGreaterThan(0)
})

test('新增的作品打得開詳情，內容是填進去的那些', async ({ page }) => {
  await page.goto('./?intro=0')
  const panel = await createWork(page)
  await panel.getByRole('button', { name: '關閉編輯面板' }).click()

  await page.getByRole('button', { name: `開啟作品：${TITLE}` }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('由 Playwright 建立的測試資料')
  await expect(dialog).toContainText('2026')
})

test('刪除自訂作品後牆上不再有它，reload 也不會回來', async ({ page }) => {
  await page.goto('./?intro=0')
  const panel = await createWork(page)

  await panel
    .locator('.work-row', { hasText: TITLE })
    .getByRole('button', { name: '刪除' })
    .click()
  await panel.getByRole('button', { name: '關閉編輯面板' }).click()

  await expect(page.getByRole('button', { name: `開啟作品：${TITLE}` })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('button', { name: `開啟作品：${TITLE}` })).toHaveCount(0)
})

const openCategoriesTab = (page) => openPanel(page, '分類')

test('新增自訂分類後出現在篩選列與作品表單，reload 後仍在', async ({ page }) => {
  await page.goto('./?intro=0')
  const panel = await openCategoriesTab(page)

  await panel.getByRole('button', { name: '＋ 新增分類' }).click()
  await panel.getByLabel('名稱').fill('複合媒材')
  await panel.getByLabel('代號').fill('MIX')
  await panel.getByRole('button', { name: '新增', exact: true }).click()

  // 出現在自訂分類清單
  await expect(panel.locator('.cat-row', { hasText: '複合媒材' })).toBeVisible()
  await panel.getByRole('button', { name: '關閉編輯面板' }).click()

  // 站頭篩選列多了這個分類
  await expect(page.getByRole('button', { name: /複合媒材/ })).toBeVisible()

  // reload 後仍在（來自 artwall.library.v2）
  await page.reload()
  await expect(page.getByRole('button', { name: /複合媒材/ })).toBeVisible()
})

test('沒有作品使用的自訂分類可以刪除', async ({ page }) => {
  await page.goto('./?intro=0')
  const panel = await openCategoriesTab(page)

  await panel.getByRole('button', { name: '＋ 新增分類' }).click()
  await panel.getByLabel('名稱').fill('暫用分類')
  await panel.getByLabel('代號').fill('TMP')
  await panel.getByRole('button', { name: '新增', exact: true }).click()

  await panel
    .locator('.cat-row', { hasText: '暫用分類' })
    .getByRole('button', { name: '刪除' })
    .click()

  await expect(panel.locator('.cat-row', { hasText: '暫用分類' })).toHaveCount(0)
})

test('建立展覽後站頭出現「依展覽」，切換顯示前言與有序作品', async ({ page }) => {
  await page.goto('./?intro=0')
  const panel = await openPanel(page, '展覽')

  await panel.getByRole('button', { name: '＋ 新增展覽' }).click()
  await panel.getByLabel('展覽名稱').fill('材料的記憶')
  await panel.getByLabel('前言').fill('這條動線關於材料被使用時留下的痕跡。')

  // 加入前兩件作品（加入後該列移到動線區，剩下的第一件遞補）
  await panel.getByRole('button', { name: '＋ 加入' }).first().click()
  await panel.getByRole('button', { name: '＋ 加入' }).first().click()
  await panel.getByRole('button', { name: '新增', exact: true }).click()

  await expect(panel.locator('.line-row', { hasText: '材料的記憶' })).toBeVisible()
  await panel.getByRole('button', { name: '關閉編輯面板' }).click()

  // 站頭出現「依展覽」模式切換
  const exhibitionMode = page.getByRole('button', { name: '依展覽' })
  await expect(exhibitionMode).toBeVisible()
  await exhibitionMode.click()

  // 前言顯示、牆上有作品
  await expect(page.locator('.app__preface')).toContainText('材料被使用時留下的痕跡')
  await expect(page.getByRole('button', { name: /^開啟作品：/ }).first()).toBeVisible()
})

test('沒有展覽時站頭不顯示模式切換——預設主頁面維持原樣', async ({ page }) => {
  await page.goto('./?intro=0')
  await expect(page.getByRole('button', { name: '依展覽' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '依媒材' })).toHaveCount(0)
})

test('隱藏內建作品後 reload 仍然是隱藏的，還原內建作品可救回', async ({ page }) => {
  await page.goto('./?intro=0')
  const panel = await openWorksTab(page)

  const firstRow = panel.locator('.work-row').first()
  const hiddenTitle = (await firstRow.locator('.work-row__title').textContent())?.trim() ?? ''
  await firstRow.getByRole('button', { name: '隱藏' }).click()
  await panel.getByRole('button', { name: '關閉編輯面板' }).click()

  await page.reload()
  await expect(page.getByRole('button', { name: `開啟作品：${hiddenTitle}` })).toHaveCount(0)

  const again = await openSiteTab(page)
  await again.getByRole('button', { name: '還原內建作品' }).click()
  await again.getByRole('button', { name: '關閉編輯面板' }).click()

  await expect(page.getByRole('button', { name: `開啟作品：${hiddenTitle}` })).toBeVisible()
})
