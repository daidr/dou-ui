import { describe, expect, it } from 'vitest'
import { CANVAS_MAX_AREA, CANVAS_MAX_SIDE, fitPixelRatio, svgToPNG } from '../../index'

describe('fitPixelRatio', () => {
  it('keeps the ratio asked for when the canvas fits', () => {
    expect(fitPixelRatio(800, 600)).toBe(2)
    expect(fitPixelRatio(800, 600, 3)).toBe(3)
  })

  it('lowers the ratio to fit the longest side', () => {
    expect(fitPixelRatio(CANVAS_MAX_SIDE / 1.5, 100, 2)).toBeCloseTo(1.5)
  })

  it('lowers the ratio to fit the area', () => {
    const side = Math.sqrt(CANVAS_MAX_AREA) / 1.25
    expect(fitPixelRatio(side, side, 2)).toBeCloseTo(1.25)
  })

  it('throws a RangeError when one pixel per CSS px is too many', () => {
    expect(() => fitPixelRatio(CANVAS_MAX_SIDE + 1, 10)).toThrow(RangeError)
    expect(() => fitPixelRatio(5000, 5000)).toThrow(RangeError)
    expect(() => fitPixelRatio(5000, 5000)).toThrow('5000×5000px')
  })

  it('takes exactly one pixel per CSS px at the limit', () => {
    expect(fitPixelRatio(CANVAS_MAX_SIDE, 1024)).toBe(1)
  })
})

describe('svgToPNG', () => {
  it('throws before drawing when the image is too big', async () => {
    await expect(svgToPNG('<svg/>', { width: 20000, height: 10 })).rejects.toThrow(RangeError)
  })
})
