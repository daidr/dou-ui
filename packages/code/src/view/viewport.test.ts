import { afterEach, describe, expect, it, vi } from 'vitest'
import { visibleViewport } from './viewport'

function stub(view: { pageTop: number; offsetTop: number; height: number }, pageTop: number) {
  vi.stubGlobal('visualViewport', { pageLeft: 0, offsetLeft: 0, width: 390, ...view })
  vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: pageTop, width: 390, height: 3000 }),
  )
}

describe('visibleViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sits offsetTop into coordinates taken from the layout viewport', () => {
    // Scrolled 500px, the keyboard pushing the view 200px further down.
    stub({ pageTop: 700, offsetTop: 200, height: 400 }, -500)
    expect(visibleViewport()).toMatchObject({ top: 200, height: 400 })
  })

  it('starts at 0 in coordinates taken from the view itself, without counting the scroll twice', () => {
    // iOS Safari: the page starts at -pageTop in the boxes it gives.
    stub({ pageTop: 700, offsetTop: 200, height: 400 }, -700)
    expect(visibleViewport()).toMatchObject({ top: 0, height: 400 })
  })
})
