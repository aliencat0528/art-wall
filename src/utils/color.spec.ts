import { describe, expect, it } from 'vitest'
import { ALL_THEME, CATEGORIES } from '@/data/categories'
import {
  contrastRatio,
  counterAccent,
  deriveAccentDark,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
} from '@/utils/color'

/**
 * accentDark 推導的重點只有一個：暗場底（#08080d）上看得見。
 * 因此測的是「對比度達標」而非「顏色等於某個值」——後者綁死實作，改演算法就假紅。
 */

const DARK_BG = { r: 0x08, g: 0x08, b: 0x0d }
const MIN_CONTRAST = 4.5

function contrastOnDark(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) throw new Error(`無法解析：${hex}`)
  return contrastRatio(rgb, DARK_BG)
}

/** 飽和度（0–1）。「有彩／無彩」的判準 */
function saturationOf(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) throw new Error(`無法解析：${hex}`)
  return rgbToHsl(rgb).s
}

describe('deriveAccentDark', () => {
  it('墨色系會被提亮——這正是暗底會整個消失的那一類', () => {
    const inkDark = deriveAccentDark('#3d3a35')

    expect(inkDark).not.toBe('#3d3a35')
    expect(contrastOnDark('#3d3a35')).toBeLessThan(MIN_CONTRAST)
    expect(contrastOnDark(inkDark)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it('內建六類的 accent 推導後都在暗底達標', () => {
    for (const category of CATEGORIES) {
      expect(contrastOnDark(deriveAccentDark(category.theme.accent))).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      )
    }
  })

  it('墨與石膏灰（原書法／立體的 accent）也照樣提亮得起來', () => {
    for (const accent of ['#3d3a35', '#6b6355']) {
      expect(contrastOnDark(deriveAccentDark(accent))).toBeGreaterThanOrEqual(MIN_CONTRAST)
    }
  })

  it('本來就夠亮的顏色不會被推暗', () => {
    const light = deriveAccentDark('#ffd9a0')

    expect(contrastOnDark(light)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it('三碼縮寫也解析得了', () => {
    expect(hexToRgb('#f0a')).toEqual({ r: 255, g: 0, b: 170 })
    expect(contrastOnDark(deriveAccentDark('#f0a'))).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it('壞輸入回中性亮色，不讓使用者亂填炸掉畫面', () => {
    expect(deriveAccentDark('not-a-color')).toBe('#f0efec')
    expect(deriveAccentDark('')).toBe('#f0efec')
  })
})

/**
 * 暗場光氛（MR-014）的兩個前提：內建六類的手工 accentDark 要在暗場底看得見，
 * 且用來當光色的 accent 必須有彩——無彩的光在暗場只會糊成一團灰霧。
 */
describe('暗場光氛的強調色', () => {
  it('六類手工調校的 accentDark 都在暗場底達標', () => {
    for (const category of CATEGORIES) {
      expect(contrastOnDark(category.theme.accentDark), category.label).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      )
    }
  })

  it('書法與立體改用有彩的材料色（印泥朱紅／陶土赭）', () => {
    for (const id of ['calligraphy', 'sculpture']) {
      const category = CATEGORIES.find((item) => item.id === id)
      expect(category).toBeDefined()
      expect(saturationOf(category!.theme.accent), id).toBeGreaterThan(0.3)
    }
  })

  it('「全部」的暗底光色也有彩——近白當光色會把展場照成無彩白霧', () => {
    expect(saturationOf(ALL_THEME.accentDark)).toBeGreaterThan(0.3)
  })

  it('「全部」在明場仍是中性的：中性定調只在暗場讓位', () => {
    expect(saturationOf(ALL_THEME.accent)).toBeLessThan(0.1)
  })
})

describe('counterAccent', () => {
  it('色相推開 156 度——正補色在暗場會打架，這個偏移量是刻意的', () => {
    const hue = (hex: string) => rgbToHsl(hexToRgb(hex)!).h * 360
    const delta = (hue(counterAccent('#4fd6e8')) - hue('#4fd6e8') + 360) % 360

    expect(delta).toBeCloseTo(156, 0)
  })

  it('飽和與亮度固定，不跟著主色一起變濃（第二色版只是配角）', () => {
    for (const accent of ['#b7332a', '#0d8a80', '#7c3aed']) {
      const hsl = rgbToHsl(hexToRgb(counterAccent(accent))!)

      expect(hsl.s, accent).toBeCloseTo(0.82, 1)
      expect(hsl.l, accent).toBeCloseTo(0.62, 1)
    }
  })

  it('壞輸入回中性亮灰，疊印框退化成白框而不是炸掉版面', () => {
    expect(counterAccent('not-a-colour')).toBe('#d8d6e0')
  })
})

describe('contrastRatio', () => {
  it('黑白對比為 21，同色為 1', () => {
    const white = { r: 255, g: 255, b: 255 }
    const black = { r: 0, g: 0, b: 0 }

    expect(contrastRatio(white, black)).toBeCloseTo(21, 1)
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5)
  })
})

describe('hex 轉換', () => {
  it('round-trip 不失真', () => {
    const rgb = hexToRgb('#2563a8')

    expect(rgb).not.toBeNull()
    expect(rgbToHex(rgb!)).toBe('#2563a8')
  })
})
