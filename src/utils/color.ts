/**
 * 顏色工具：把使用者選的 accent 自動推導出暗底可用的 accentDark。
 *
 * 為什麼要推導（MR-008／MR-012 ③）：分類強調色在暗場底（`--bg: #08080d`）上，
 * 深色系會整個消失。使用者只該選一個顏色，暗底版本由此自動算出——
 * 提亮到足夠亮度，並驗證對比度達標，達不到就繼續提亮。
 *
 * 另備 `counterAccent`：暗場疊印框要的第二個色版（MR-014）。
 */

interface Rgb {
  r: number
  g: number
  b: number
}

interface Hsl {
  h: number
  s: number
  l: number
}

/** 暗場背景色（`main.css` 的 `--bg`），推導對比度的基準 */
const DARK_BG: Rgb = { r: 0x08, g: 0x08, b: 0x0d }
/** WCAG AA 對一般文字的對比門檻；強調線條取同一標準求穩 */
const MIN_CONTRAST = 4.5

export function hexToRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2

  if (delta === 0) return { h: 0, s: 0, l }

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / delta + 2) / 6
  else h = ((rn - gn) / delta + 4) / 6
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    let tn = t
    if (tn < 0) tn += 1
    if (tn > 1) tn -= 1
    if (tn < 1 / 6) return p + (q - p) * 6 * tn
    if (tn < 1 / 2) return q
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
    return p
  }
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  }
}

/** WCAG 相對亮度 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const cs = c / 255
    return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** 兩色對比度（1–21） */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 疊印框的第二個色版（MR-014）。
 *
 * 暗場的「疊印」與紙上的疊印不是同一件事：紙上是 multiply（墨愈疊愈暗），
 * 暗場是 screen（光愈疊愈亮）。所以這裡做的是**色差錯位**——兩道色光往反方向偏移，
 * 相交處加成出白光，等於沒對準的兩塊光版。
 *
 * 色相不取正補色（+180）：正補色在暗場會打架，偏 156 度既有色差又還算和諧。
 * 飽和與亮度寫死而不沿用輸入值——第二版只是配角，跟著主色一起變濃會搶戲。
 */
export function counterAccent(accent: string): string {
  const rgb = hexToRgb(accent)
  // 解析不了就回中性亮灰：疊印框會退化成單純的白框，不會炸掉版面
  if (!rgb) return '#d8d6e0'
  const { h } = rgbToHsl(rgb)
  const counter = ((h * 360 + 156) % 360) / 360
  return rgbToHex(hslToRgb({ h: counter, s: 0.82, l: 0.62 }))
}

/**
 * 由 accent 推導暗底版本：提亮到至少 0.62，過飽和稍降，
 * 對暗底對比不足就每次 +0.03 續提亮，直到達標或接近全白。
 */
export function deriveAccentDark(accent: string): string {
  const rgb = hexToRgb(accent)
  // 顏色解析不了就回中性亮色（與 ALL_THEME.accentDark 同調），不讓壞輸入炸掉
  if (!rgb) return '#f0efec'

  const hsl = rgbToHsl(rgb)
  let l = Math.max(hsl.l, 0.62)
  const s = hsl.s > 0.7 ? 0.7 : hsl.s

  let out = hslToRgb({ h: hsl.h, s, l })
  let guard = 0
  while (contrastRatio(out, DARK_BG) < MIN_CONTRAST && l < 0.95 && guard < 20) {
    l += 0.03
    out = hslToRgb({ h: hsl.h, s, l })
    guard += 1
  }
  return rgbToHex(out)
}
