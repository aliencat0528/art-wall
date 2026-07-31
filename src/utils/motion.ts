/**
 * 互動動態的共用數學（MR-016）。
 *
 * 放在 utils 而不是各元件內，是為了讓它們測得到——游標殘像與拖曳套色錯位
 * 都是「每帧算一個數字寫進 CSS 變數」，會出錯的地方全在這幾條公式上，
 * 至於那個數字長成什麼視覺，斷言不了也不該斷言（見 docs/TESTING.md）。
 */

/** 線性內插。`t` 為每帧追上的比例，0＝完全不動、1＝立刻到位 */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.min(Math.max(t, 0), 1)
}

/** 套色錯位的最大倍率。再大就從「印歪了」變成「破圖」 */
const MISREG_MAX = 3.2

/** velocity 到滿格所需的速度（px/ms）。約等於一秒拖過一個螢幕寬 */
const MISREG_FULL_SPEED = 1.6

/**
 * 拖曳速度 → 疊印第二色版的偏移倍率（1＝原本的靜止錯位）。
 * 拖得越快印得越歪，這是 Risograph 套色沒對準的物理，不是裝飾。
 */
export function misregFor(velocity: number): number {
  const ratio = Math.min(Math.abs(velocity) / MISREG_FULL_SPEED, 1)
  return 1 + ratio * (MISREG_MAX - 1)
}
