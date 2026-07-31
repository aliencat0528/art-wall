/**
 * 走廊模式的純幾何（MR-017）。
 *
 * 這裡只算數字，不碰 DOM——`GalleryHall.vue` 把結果寫成 inline style。
 * 拆出來的理由與 `useImageZoom`（MR-015）相同：透視觀感沒有自動化測試測得了，
 * 但「第幾件對到哪個座標」是可以測的，把可測的部分留在純函式裡。
 */

/**
 * 作品沿 Z 軸的間距，也決定「一步走多遠」的體感。
 *
 * MR-018 把作品放大之後這個值要跟著加大：看板是正對螢幕的平面，相鄰兩件在螢幕上
 * 的水平距離只由透視縮放差決定，間距太小就會**互相重疊**（實測 460 時左右兩列
 * 各有兩件疊在一起）。
 */
export const HALL_SPACING = 720



/** 夾住步數。空清單時回 0，不讓 `-1` 或超界流進 transform */
export function clampStep(step: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(Math.round(step), total - 1))
}

/** 第 n 步時相機推進的距離。往前走＝場景往觀者移，故為正值 */
export function cameraZ(step: number, spacing: number = HALL_SPACING): number {
  return step * spacing
}

/**
 * 第一件作品與相機起點的距離。
 *
 * 沒有這一段的話，第 n 件的深度剛好等於第 n 步的相機位置——作品會貼在
 * 相機所在平面上。留一個站距，走到它面前才是「站在作品前」而不是「臉貼上去」。
 *
 * 改成正對螢幕的看板之後（MR-018）這個值要**縮到很短，甚至為負**。
 * 當前那件永遠停在 `z = -HALL_LEAD`，透視縮放就是
 * `perspective / (perspective + LEAD)`：
 *
 * | LEAD | 縮放 | 讀起來 |
 * |------|------|--------|
 * | 150 | 0.81 | 比原尺寸小，很遠 |
 * | 40 | 0.94 | 接近 1:1 |
 * | -90 | 1.17 | 跨到投影面前方 |
 * | **-150** | **1.32** | 近到會溢出畫面兩側，「就在眼前」 |
 *
 * 負值代表作品在投影面與觀者之間。上限是 `perspective`（620）——
 * 到那裡就會穿過相機平面。已走過的那件在 `z = spacing - LEAD = 810`，
 * 確實越過了相機平面，但它 `opacity: 0`，看不到也點不到。
 */
export const HALL_LEAD = -150

export interface HallSlot {
  /** 掛在哪面牆。偶數件在左、奇數件在右，兩側交錯才像走廊 */
  side: 'left' | 'right'
  /** 沿 Z 軸的深度（px），第 0 件為一個站距 */
  depth: number
}

export function slotFor(index: number, spacing: number = HALL_SPACING): HallSlot {
  return {
    side: index % 2 === 0 ? 'left' : 'right',
    depth: HALL_LEAD + index * spacing,
  }
}

/**
 * 這一件現在算不算「近景」。
 *
 * 近景要換用 `view`（1800px）那張——縮圖只有 800px（MR-009），
 * 走廊裡最近那件會佔到半個畫面寬，800px 撐不住（限制 4）。
 * 半徑取 1 而非 0：下一件在走過去的途中就已經很大了，等走到才換圖會看到它先糊後清。
 */
export function isNear(index: number, step: number, radius = 1): boolean {
  return Math.abs(index - step) <= radius
}

/**
 * 這一件該不該進 DOM。
 *
 * 全部渲染會讓 50 件作品同時在 3D 場景裡合成，而遠處那些一個像素都看不到。
 *
 * **後方只留 1 件**：走過去的作品在相機側後方，透視會把它放到極大——實測留 3 件時
 * 左右兩側各有一片被撐爆的白色圖面，佔掉三分之一畫面。留 1 件是為了往回走時
 * 它已經在場上，不會憑空跳出來。
 */
export function isVisible(index: number, step: number, ahead = 8, behind = 1): boolean {
  return index >= step - behind && index <= step + ahead
}

/** 已經走過的作品。它在你身後——不該搶視覺重量，也不該還能點 */
export function isPassed(index: number, step: number): boolean {
  return index < step
}
