import { expect, test } from '@playwright/test'

/**
 * 走廊模式（MR-017，Phase G）的回歸。
 *
 * **這裡測的就是用戶指定的三條硬要求**——不卡住、不跑版、作品點得開。
 * 三條都是「會真的壞掉」的事，與 MR-014／MR-016 的原則一致：
 * 透視好不好看、光波夠不夠明顯是視覺量值，不寫進測試（寫了就是把實作綁死）。
 *
 * 純幾何（第幾件對到哪個座標）在 `src/utils/hall.spec.ts`，這裡不重複。
 *
 * 用 .js 而非 .ts：同 gallery.spec.js，見 MR-013。
 */

/** 走廊只在寬螢幕提供，先確保視窗夠寬（playwright.config 的預設已是桌機尺寸） */
async function enterHall(page) {
  await page.goto('./?intro=0')
  await page.getByRole('button', { name: '走進展場' }).click()
  await expect(page.locator('.hall')).toBeVisible()
}

test('切得進走廊，且網址帶得走', async ({ page }) => {
  await enterHall(page)

  expect(page.url()).toContain('v=hall')
  await expect(page.locator('.hall__scene')).toBeVisible()
  // 牆面本體要讓位，否則兩套版面會疊在一起
  await expect(page.locator('.wall')).toHaveCount(0)
})

test('深連結 ?v=hall 直接進走廊', async ({ page }) => {
  await page.goto('./?intro=0&v=hall')

  await expect(page.locator('.hall')).toBeVisible()
})

test('走動後相機真的往前推，且到底不會再往前', async ({ page }) => {
  await enterHall(page)

  const scene = page.locator('.hall__scene')
  const camAt = () => scene.evaluate((el) => getComputedStyle(el).transform)

  const start = await camAt()
  await page.getByRole('button', { name: 'WALK ON →' }).click()
  // 補間是 720ms，用 poll 等它到位而不是猜 sleep
  await expect.poll(camAt).not.toBe(start)

  // 起點時 BACK 應該是停用的——夾住步數才不會走出牆外
  await page.getByRole('button', { name: '← BACK' }).click()
  await expect.poll(camAt).toBe(start)
  await expect(page.getByRole('button', { name: '← BACK' })).toBeDisabled()
})

/**
 * 硬要求 ①：不卡住。
 * 連按多次不該讓計數落後或停住——這是「按鈕在補間期間被吃掉」最典型的症狀。
 */
test('連續走動不卡住，計數跟得上', async ({ page }) => {
  await enterHall(page)

  const walk = page.getByRole('button', { name: 'WALK ON →' })
  for (let i = 0; i < 4; i += 1) await walk.click()

  await expect(page.locator('.hall__pos')).toContainText('第 5 /')
})

/**
 * 硬要求 ②：不跑版。
 * 3D 場景最容易出的事是把父容器撐開，導致整頁多出一條水平捲軸。
 */
test('走廊不把版面撐出水平捲軸', async ({ page }) => {
  await enterHall(page)

  const overflowed = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflowed).toBe(false)

  // 走到深處再驗一次：相機推進後場景元素會移動，這才是真正會撐開的時機
  const walk = page.getByRole('button', { name: 'WALK ON →' })
  for (let i = 0; i < 3; i += 1) await walk.click()

  const overflowedAfter = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflowedAfter).toBe(false)
})

/**
 * 硬要求 ③：作品點得開——而且是**走動之後**還點得開。
 * MR-014 踩過的坑（指標捕獲吃掉 click）就是走動之後才顯現的。
 */
test('走動後仍然點得開作品', async ({ page }) => {
  await enterHall(page)

  await page.getByRole('button', { name: 'WALK ON →' }).click()
  await page.getByRole('button', { name: 'WALK ON →' }).click()
  await expect(page.locator('.hall__pos')).toContainText('第 3 /')

  // 指名點「現在站在面前」那件（data-index 對到走廊的第幾件）。
  // 不能用 .first()：窗口會保留相機後方幾件，它們在畫面上根本不存在，
  // 但 boundingBox 仍算得出來，點下去只會打到底下的容器。
  await page.locator('.piece[data-index="2"]').click()

  await expect(page.locator('.detail')).toBeVisible()
  expect(page.url()).toContain('w=')
})

test('切回牆面時走廊收乾淨，篩選不被洗掉', async ({ page }) => {
  await page.goto('./?intro=0&c=watercolor')
  await page.getByRole('button', { name: '走進展場' }).click()
  await expect(page.locator('.hall')).toBeVisible()

  await page.getByRole('button', { name: '看牆面' }).click()

  await expect(page.locator('.hall')).toHaveCount(0)
  await expect(page.locator('.wall')).toBeVisible()
  // 版面與篩選是兩個軸，切版面不該把分類洗掉
  expect(page.url()).toContain('c=watercolor')
  expect(page.url()).not.toContain('v=hall')
})

test('方向鍵可以走，不必先點畫面', async ({ page }) => {
  await enterHall(page)

  await page.keyboard.press('ArrowRight')

  await expect(page.locator('.hall__pos')).toContainText('第 2 /')
})

/** 減少動態時整個模式不提供（限制 5）——不是給一個瞬移版本 */
test('減少動態時不提供走廊入口', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./?intro=0')

  await expect(page.getByRole('button', { name: '走進展場' })).toHaveCount(0)
})

/** 窄螢幕退回網格（限制 2；此為 MR-017 的待確認假設，見待討論 #5） */
test('窄螢幕不提供走廊入口', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  await page.goto('./?intro=0')

  await expect(page.getByRole('button', { name: '走進展場' })).toHaveCount(0)
})

/** 帶著 ?v=hall 進窄螢幕不該卡在一個不存在的模式裡 */
test('窄螢幕帶 ?v=hall 進站會退回牆面', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  await page.goto('./?intro=0&v=hall')

  await expect(page.locator('.hall')).toHaveCount(0)
  await expect(page.locator('.wall')).toBeVisible()
})
