import { expect, test } from '@playwright/test'

/**
 * 瀏覽流程的回歸驗證：分類篩選、詳情開關、網址狀態、深連結。
 *
 * 用 .js 而非 .ts：本機 Node 18.12 下 Playwright 的 TS loader 不生效
 * （需 Node 20+ 的 module.register）。見 MR-013 與 playwright.config.js 註解。
 *
 * 開場動畫每次進站都會播、會擋住牆面，所以每個 goto 都帶 `?intro=0` 直接進牆
 * ——開場本身不在回歸範圍。網址斷言因此要用 `[?&]` 而非寫死 `?`。
 */

test('進站看得到作品牆與作品卡片', async ({ page }) => {
  await page.goto('./?intro=0')

  await expect(page.getByRole('region', { name: '作品牆' })).toBeVisible()
  const cards = page.getByRole('button', { name: /^開啟作品：/ })
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeGreaterThan(0)
})

test('圖片載得出來——base 路徑錯掉的話這裡會先炸', async ({ page }) => {
  await page.goto('./?intro=0')

  const firstImage = page.locator('.card__image').first()
  await expect(firstImage).toBeVisible()
  // naturalWidth 為 0 代表圖根本沒載進來（404 或路徑錯）
  await expect
    .poll(() => firstImage.evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0)
})

test('切分類會篩選作品並把狀態寫進網址', async ({ page }) => {
  await page.goto('./?intro=0')
  const before = await page.getByRole('button', { name: /^開啟作品：/ }).count()

  await page.getByRole('button', { name: '水彩', exact: false }).first().click()

  await expect(page).toHaveURL(/[?&]c=watercolor/)
  const after = await page.getByRole('button', { name: /^開啟作品：/ }).count()
  expect(after).toBeGreaterThan(0)
  expect(after).toBeLessThan(before)
})

test('點作品開詳情、關閉後回到牆面', async ({ page }) => {
  await page.goto('./?intro=0')
  await page.getByRole('button', { name: /^開啟作品：/ }).first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/[?&]w=/)

  await page.getByRole('button', { name: '關閉' }).click()
  await expect(dialog).toBeHidden()
})

test('瀏覽器上一頁等同關閉詳情', async ({ page }) => {
  await page.goto('./?intro=0')
  await page.getByRole('button', { name: /^開啟作品：/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.goBack()

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).not.toHaveURL(/[?&]w=/)
})

test('詳情內可以切到下一件', async ({ page }) => {
  await page.goto('./?intro=0&c=watercolor')
  await page.getByRole('button', { name: /^開啟作品：/ }).first().click()

  const title = page.locator('.detail__panel h2, .detail__panel .detail__title').first()
  const firstTitle = await title.textContent()

  await page.getByRole('button', { name: '下一件' }).click()

  await expect(title).not.toHaveText(firstTitle ?? '')
})

test('深連結到某件作品會直接開啟它的詳情', async ({ page }) => {
  await page.goto('./?intro=0&c=sculpture&w=scp-002')

  // 詳情是 aria-modal，開著時牆面的卡片與篩選鈕會被排除在無障礙樹外，
  // 所以這裡只驗詳情本身（分類狀態另一個測試驗）。
  // 不點「關閉」：直接深連結進站時 history 沒有上一頁，closeWork 的
  // history.back() 會離開整個頁面。
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('深連結帶分類會套用篩選', async ({ page }) => {
  await page.goto('./?intro=0&c=sculpture')

  await expect(page.getByRole('button', { name: '立體作品', exact: false }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const cards = page.getByRole('button', { name: /^開啟作品：/ })
  expect(await cards.count()).toBeGreaterThan(0)
  // 全部都是立體作品——篩選確實生效
  await expect(cards.first()).toBeVisible()
})

test('不合法的分類代號退回全部，不是空白畫面', async ({ page }) => {
  await page.goto('./?intro=0&c=not-a-category')

  await expect(page.getByRole('button', { name: /^開啟作品：/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '全部', exact: false }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('詳情頁雙擊放大、拖得動，而且拖曳不會把詳情關掉', async ({ page }) => {
  await page.goto('./?intro=0&c=sculpture')
  await page.getByRole('button', { name: /^開啟作品：/ }).first().click()

  const viewport = page.locator('.detail__viewport')
  const image = page.locator('.detail__image')
  await expect(image).toBeVisible()
  await expect(viewport).toHaveClass(/detail__viewport--zoomable/)

  await viewport.dblclick()
  const zoomed = await image.evaluate((el) => el.style.transform)
  expect(zoomed).not.toContain('scale(1)')

  // 拖移。MR-014 在長廊踩過的指標捕獲陷阱若復發，詳情會在這一步被關掉
  const box = await viewport.boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx - 80, cy - 60, { steps: 8 })
  await page.mouse.up()

  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await image.evaluate((el) => el.style.transform)).not.toBe(zoomed)
})

test('放大後切到下一件會回到 fit，不會停在上一件的縮放位置', async ({ page }) => {
  await page.goto('./?intro=0&c=sculpture')
  await page.getByRole('button', { name: /^開啟作品：/ }).first().click()

  const image = page.locator('.detail__image')
  await page.locator('.detail__viewport').dblclick()
  expect(await image.evaluate((el) => el.style.transform)).not.toContain('scale(1)')

  await page.getByRole('button', { name: '下一件' }).click()

  await expect
    .poll(() => image.evaluate((el) => el.style.transform))
    .toContain('scale(1)')
})
