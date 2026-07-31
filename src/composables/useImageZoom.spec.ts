import { describe, expect, it } from 'vitest'
import { anchorOffset, clampOffset, clampScale, maxScaleFor } from '@/composables/useImageZoom'

/**
 * 只測純函式（夾制與錨點數學）。手勢綁定與 DOM 量測交給 E2E——
 * jsdom 沒有版面，`offsetWidth` 一律是 0，在這裡測等於測假的。
 */

/** 某個內容座標（以圖片中心為原點、未縮放）在畫面上的位置 */
function screenOf(contentX: number, offset: number, scale: number): number {
  return offset + contentX * scale
}

describe('maxScaleFor', () => {
  it('原圖像素除以顯示尺寸就是還能放大幾倍', () => {
    expect(maxScaleFor(1800, 900)).toBe(2)
    expect(maxScaleFor(1800, 600)).toBe(3)
  })

  it('顯示尺寸已經大於等於原圖時不給放大——再放大只是放大壓縮痕跡', () => {
    expect(maxScaleFor(800, 900)).toBe(1)
    expect(maxScaleFor(900, 900)).toBe(1)
  })

  it('圖還沒載完（naturalWidth 為 0）視為不可放大，而不是無限大', () => {
    expect(maxScaleFor(0, 900)).toBe(1)
    expect(maxScaleFor(1800, 0)).toBe(1)
  })

  it('極小的顯示尺寸不會換來破格的倍率', () => {
    expect(maxScaleFor(4000, 20)).toBe(8)
  })
})

describe('clampScale', () => {
  it('下限是 1：縮不到比 fit 更小', () => {
    expect(clampScale(0.4, 3)).toBe(1)
  })

  it('上限吃 maxScale', () => {
    expect(clampScale(9, 3)).toBe(3)
    expect(clampScale(2, 3)).toBe(2)
  })
})

describe('clampOffset', () => {
  it('圖沒溢出視窗就鎖在中央，拖不動', () => {
    expect(clampOffset(120, 600, 900)).toBe(0)
    // 夾到 -0 與 0 對 CSS translate 等價，用 closeTo 避免測到 JS 的正負零之分
    expect(clampOffset(-120, 900, 900)).toBeCloseTo(0)
  })

  it('可拖的距離等於溢出的那一半', () => {
    // 圖 1800、框 900 → 兩側各多出 450
    expect(clampOffset(900, 1800, 900)).toBe(450)
    expect(clampOffset(-900, 1800, 900)).toBe(-450)
    expect(clampOffset(200, 1800, 900)).toBe(200)
  })
})

describe('anchorOffset', () => {
  it('放大後，指標底下的那一點停在原地', () => {
    const pointer = 100
    const contentX = (pointer - 0) / 1 // fit 狀態下指標對到的內容座標

    const next = anchorOffset(0, pointer, 3)

    expect(screenOf(contentX, next, 3)).toBeCloseTo(pointer)
  })

  it('從已放大的狀態再放大也成立', () => {
    const offset = -200
    const scale = 3
    const pointer = -60
    const contentX = (pointer - offset) / scale

    const next = anchorOffset(offset, pointer, 5 / 3)

    expect(screenOf(contentX, next, 5)).toBeCloseTo(pointer)
  })

  it('倍率不變時位移不動', () => {
    expect(anchorOffset(37, 120, 1)).toBeCloseTo(37)
  })
})
