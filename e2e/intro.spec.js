import { expect, test } from '@playwright/test'

/**
 * 開場序列與它的斜對角開門收尾（MR-019）。
 *
 * **測的是「會不會把使用者關在門外」**，不是門好不好看。開門是一層 `position: fixed`
 * 的滿版覆蓋，它退不乾淨或退不掉，站台就等於打不開——這是唯一真的會壞的事。
 * 位移量、緩動曲線、縫多寬都是視覺量值，比照 `hall.spec.js` 不寫進測試。
 *
 * 用 .js 而非 .ts：同 gallery.spec.js，見 MR-013。
 */

test('開場會自動結束，而且結束後畫面真的可以點', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.intro')).toBeVisible()

  // 幾何動畫 2.9s + 開門 0.9s = 3.8s；給到 8s 是留給 CI 的慢機器
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 8000 })

  // 「門退掉了」的真正判準不是元素消失，而是底下的東西點得到——
  // 覆蓋層若有殘留（transform 沒跑完、pointer-events 沒收），這一步會直接卡住
  await page.locator('.card').first().click()
  await expect(page.locator('.detail')).toBeVisible()
})

test('點畫面任何一處都能跳過開場，不必命中那顆鈕', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.intro')).toBeVisible()

  // 刻意點在左上角——離右下角那顆「跳過開場」最遠的地方
  await page.mouse.click(40, 40)

  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 3000 })
})

test('兩片門在開場期間合起來蓋滿畫面', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.door--a')).toBeAttached()

  // 沿對角線切開的兩半必須互補，任何一片的 clip-path 寫錯都會露出一條縫
  const covered = await page.evaluate(() => {
    const points = [
      [4, 4],
      [innerWidth - 4, 4],
      [4, innerHeight - 4],
      [innerWidth - 4, innerHeight - 4],
      [innerWidth / 2, innerHeight / 2],
    ]
    return points.every((point) => {
      const el = document.elementFromPoint(point[0], point[1])
      return !!el && !!el.closest('.intro')
    })
  })

  expect(covered).toBe(true)
})
