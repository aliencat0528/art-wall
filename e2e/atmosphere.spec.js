import { expect, test } from '@playwright/test'

/**
 * 疊印視覺（MR-016）的回歸。
 *
 * 這裡**不斷言好不好看**——色圓的位置、模糊半徑、顆粒濃度都是視覺量值，
 * 寫進測試等於把實作綁死（同 MR-014 對長廊景深的處理）。
 * 測的是「會真的壞掉」的三件事：殘像有沒有跟著游標、拖曳有沒有推開套色錯位、
 * 放手有沒有收回去。純數學的部分在 `src/utils/motion.spec.ts`。
 *
 * 用 .js 而非 .ts：同 gallery.spec.js，見 MR-013。
 */

test('游標殘像跟著游標，且兩顆有先後之分', async ({ page }) => {
  await page.goto('./?intro=0')

  const lead = page.locator('.atmo__trail--a')
  const lag = page.locator('.atmo__trail--b')
  const centre = (box) => [box.x + box.width / 2, box.y + box.height / 2]

  await page.mouse.move(200, 200)
  await page.mouse.move(900, 500, { steps: 20 })

  // 追隨是 rAF 漸進的，用 poll 等它靠近，而不是猜一個 sleep 長度
  await expect
    .poll(async () => {
      const [x] = centre(await lead.boundingBox())
      return Math.abs(x - 900)
    })
    .toBeLessThan(60)

  const [leadX] = centre(await lead.boundingBox())
  const [lagX] = centre(await lag.boundingBox())
  // 慢的那顆還在後面——兩顆重合就沒有「殘像」可言了
  expect(lagX).toBeLessThan(leadX)
})

test('停下來之後殘像會散掉', async ({ page }) => {
  await page.goto('./?intro=0')
  await page.mouse.move(400, 400)
  await page.mouse.move(800, 400, { steps: 10 })

  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--trail-on').trim(),
  ), { timeout: 5000 }).toBe('0')
})

test('拖曳長廊會推開套色錯位，放手收回', async ({ page }) => {
  await page.goto('./?intro=0')
  const track = page.locator('.wall__track')
  await expect(track).toBeVisible()

  const misreg = () =>
    track.evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--misreg') || 1))

  expect(await misreg()).toBe(1)

  const box = await track.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 420, box.y + box.height / 2, { steps: 6 })

  expect(await misreg()).toBeGreaterThan(1)

  await page.mouse.up()

  // 「彈回原位」＝回到 1，容差留給 rAF 收尾的最後一兩帧
  await expect.poll(misreg).toBeLessThan(1.02)
})
