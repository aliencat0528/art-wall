import { describe, expect, it } from 'vitest'
import {
  HALL_LEAD,
  HALL_SPACING,
  cameraZ,
  clampStep,
  isNear,
  isPassed,
  isVisible,
  slotFor,
} from '@/utils/hall'

describe('clampStep', () => {
  it('夾在 0 與 total-1 之間', () => {
    expect(clampStep(-3, 5)).toBe(0)
    expect(clampStep(9, 5)).toBe(4)
    expect(clampStep(2, 5)).toBe(2)
  })

  it('空清單一律回 0——不讓 -1 流進 transform', () => {
    expect(clampStep(0, 0)).toBe(0)
    expect(clampStep(4, 0)).toBe(0)
  })

  it('小數取整，避免產生半步的相機位置', () => {
    expect(clampStep(1.6, 5)).toBe(2)
  })
})

describe('cameraZ', () => {
  it('第 0 步不推進', () => {
    expect(cameraZ(0)).toBe(0)
  })

  it('每步推進一個間距', () => {
    expect(cameraZ(3)).toBe(3 * HALL_SPACING)
    expect(cameraZ(2, 100)).toBe(200)
  })
})

describe('slotFor', () => {
  it('偶數件掛左牆、奇數件掛右牆', () => {
    expect(slotFor(0).side).toBe('left')
    expect(slotFor(1).side).toBe('right')
    expect(slotFor(2).side).toBe('left')
  })

  it('深度隨索引等距後退，並整體讓開一個站距', () => {
    expect(slotFor(0).depth).toBe(HALL_LEAD)
    expect(slotFor(3, 100).depth).toBe(HALL_LEAD + 300)
  })

  it('相鄰兩件的間距就是 spacing——站距是平移不是縮放', () => {
    expect(slotFor(2).depth - slotFor(1).depth).toBe(HALL_SPACING)
  })
})

describe('isNear', () => {
  it('相機所在與前後一件算近景', () => {
    expect(isNear(4, 4)).toBe(true)
    expect(isNear(5, 4)).toBe(true)
    expect(isNear(3, 4)).toBe(true)
  })

  it('再遠就不換大圖', () => {
    expect(isNear(6, 4)).toBe(false)
  })
})

describe('isVisible', () => {
  it('前方留 8 件', () => {
    expect(isVisible(12, 4)).toBe(true)
    expect(isVisible(13, 4)).toBe(false)
  })

  it('後方只留 1 件——留多了會有被撐爆的圖面佔住畫面兩側', () => {
    expect(isVisible(3, 4)).toBe(true)
    expect(isVisible(2, 4)).toBe(false)
  })

  it('起點時後方沒有東西也不會出錯', () => {
    expect(isVisible(0, 0)).toBe(true)
  })
})

describe('isPassed', () => {
  it('索引小於目前步數＝已經走過，在相機身後', () => {
    expect(isPassed(1, 2)).toBe(true)
    expect(isPassed(2, 2)).toBe(false)
    expect(isPassed(3, 2)).toBe(false)
  })
})
