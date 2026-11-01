import { afterEach, describe, expect, it, vi } from 'vitest'
import { CANVAS_MAX_SIDE, canvasMaxArea, fitPixelRatio, svgToPNG } from '../../index'

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as { GestureEvent?: unknown }).GestureEvent
})

/** iPhone and iPad: Safari underneath, with touch. */
function touchSafari() {
  ;(window as { GestureEvent?: unknown }).GestureEvent = Event
  vi.stubGlobal('navigator', { ...navigator, maxTouchPoints: 5 })
}

describe('canvasMaxArea', () => {
  it('is the whole square on most browsers', () => {
    expect(canvasMaxArea()).toBe(CANVAS_MAX_SIDE * CANVAS_MAX_SIDE)
  })

  it('is about 16.7 million pixels on iPhone and iPad', () => {
    touchSafari()
    expect(canvasMaxArea()).toBe(16_777_216)
  })
})

describe('fitPixelRatio', () => {
  it('keeps the ratio asked for when the canvas fits', () => {
    expect(fitPixelRatio(800, 600)).toBe(2)
    expect(fitPixelRatio(800, 600, 3)).toBe(3)
  })

  it('lowers the ratio to fit the longest side', () => {
    expect(fitPixelRatio(CANVAS_MAX_SIDE / 1.5, 100, 2)).toBeCloseTo(1.5)
  })

  it('takes a long image at one pixel per CSS px on desktop', () => {
    // a gantt chart of about 400 rows
    expect(fitPixelRatio(1500, 14000, 2)).toBeCloseTo(CANVAS_MAX_SIDE / 14000)
  })

  it('lowers the ratio to fit the area on iPhone and iPad', () => {
    touchSafari()
    const side = 4096 / 1.25
    expect(fitPixelRatio(side, side, 2)).toBeCloseTo(1.25)
    expect(() => fitPixelRatio(1500, 14000)).toThrow(RangeError)
  })

  it('throws a RangeError when one pixel per CSS px is too many', () => {
    expect(() => fitPixelRatio(CANVAS_MAX_SIDE + 1, 10)).toThrow(RangeError)
    expect(() => fitPixelRatio(20000, 100)).toThrow('20000×100px')
  })

  it('names the package and what to do', () => {
    expect(() =>
      fitPixelRatio(20000, 100, 2, { scope: '@dou-ui/chart', hint: 'use exportSVG()' }),
    ).toThrow(/^\[@dou-ui\/chart\] The image would be 20000×100px.*; use exportSVG\(\)$/)
  })

  it('takes exactly one pixel per CSS px at the limit', () => {
    expect(fitPixelRatio(CANVAS_MAX_SIDE, 1024)).toBe(1)
  })

  it('throws a RangeError for a size or ratio that is not a positive number', () => {
    for (const [w, h] of [
      [0, 10],
      [10, -1],
      [Number.NaN, 10],
      [10, Number.POSITIVE_INFINITY],
    ])
      expect(() => fitPixelRatio(w!, h!)).toThrow(RangeError)
    for (const ratio of [0, -1, Number.NaN])
      expect(() => fitPixelRatio(100, 100, ratio)).toThrow(RangeError)
  })
})

describe('svgToPNG', () => {
  it('throws before drawing when the image is too big', async () => {
    await expect(svgToPNG('<svg/>', { width: 20000, height: 10 })).rejects.toThrow(RangeError)
  })

  it('says the SVG could not be drawn, with the browser error as the cause', async () => {
    const cause = new Error('The source image cannot be decoded.')
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockRejectedValue(cause)
    const error = await svgToPNG('<svg', { width: 10, height: 10, scope: '@dou-ui/flow' }).catch(
      (e: Error) => e,
    )
    expect((error as Error).message).toMatch(/^\[@dou-ui\/flow\] The SVG could not be drawn/)
    expect((error as Error).cause).toBe(cause)
    vi.restoreAllMocks()
  })
})
