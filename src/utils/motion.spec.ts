import { describe, expect, it } from 'vitest'
import { lerp, misregFor } from '@/utils/motion'

describe('lerp', () => {
  it('t 為 0 停在原地、1 直接到位', () => {
    expect(lerp(10, 20, 0)).toBe(10)
    expect(lerp(10, 20, 1)).toBe(20)
  })

  it('反覆套用會收斂到目標，不會過衝', () => {
    let value = 0
    for (let i = 0; i < 60; i += 1) value = lerp(value, 100, 0.2)

    expect(value).toBeGreaterThan(99.9)
    expect(value).toBeLessThanOrEqual(100)
  })

  it('t 超出 0～1 會被夾住——rAF 掉帧時算出的補償值可能爆掉', () => {
    expect(lerp(0, 100, 3)).toBe(100)
    expect(lerp(0, 100, -2)).toBe(0)
  })
})

describe('misregFor', () => {
  it('靜止時就是原本的錯位量（倍率 1）', () => {
    expect(misregFor(0)).toBe(1)
  })

  it('拖得越快錯位越大', () => {
    expect(misregFor(0.8)).toBeGreaterThan(misregFor(0.2))
  })

  it('往左往右一樣歪——方向不影響套色偏移的大小', () => {
    expect(misregFor(-0.9)).toBeCloseTo(misregFor(0.9))
  })

  it('再快也有上限，不會變成破圖', () => {
    expect(misregFor(999)).toBe(3.2)
    expect(misregFor(1.6)).toBe(3.2)
  })
})
