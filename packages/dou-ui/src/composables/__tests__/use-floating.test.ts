import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { computePosition, useFloating } from '../use-floating'
import type { PositionOptions } from '../use-floating'

const options: PositionOptions = {
  offset: 8,
  padding: 8,
  flip: true,
  viewport: { width: 1000, height: 800 },
}
const reference = { x: 400, y: 300, width: 100, height: 32 }
const size = { width: 200, height: 100 }

describe('computePosition', () => {
  it('places the box on each side, centered or aligned', () => {
    expect(computePosition(reference, size, 'bottom', options)).toMatchObject({
      x: 350,
      y: 340,
      placement: 'bottom',
    })
    expect(computePosition(reference, size, 'top-start', options)).toMatchObject({
      x: 400,
      y: 192,
      placement: 'top-start',
    })
    expect(computePosition(reference, size, 'bottom-end', options)).toMatchObject({ x: 300 })
    expect(computePosition(reference, size, 'right', options)).toMatchObject({ x: 508, y: 266 })
    expect(computePosition(reference, size, 'left', options)).toMatchObject({ x: 192, y: 266 })
  })

  it('flips to the opposite side when the preferred one has no room', () => {
    const nearTop = { ...reference, y: 40 }
    expect(computePosition(nearTop, size, 'top', options)).toMatchObject({
      placement: 'bottom',
      y: 80,
    })
    const nearBottom = { ...reference, y: 740 }
    expect(computePosition(nearBottom, size, 'bottom-start', options).placement).toBe('top-start')
  })

  it('stays put when neither side has room', () => {
    const tall = { width: 200, height: 700 }
    expect(computePosition(reference, tall, 'bottom', options).placement).toBe('bottom')
  })

  it('slides along the edge to stay inside the viewport', () => {
    const nearLeft = { ...reference, x: 0 }
    expect(computePosition(nearLeft, size, 'bottom', options).x).toBe(8)
    const nearRight = { ...reference, x: 950 }
    expect(computePosition(nearRight, size, 'bottom', options).x).toBe(792)
  })

  it('keeps a box beside the reference on screen when neither side fits', () => {
    // a submenu on a phone: the menu fills most of the width
    const phone = { ...options, viewport: { width: 390, height: 800 } }
    const item = { x: 150, y: 300, width: 200, height: 32 }
    const sub = computePosition(item, size, 'right-start', phone)
    expect(sub.placement).toBe('left-start')
    expect(sub.x).toBe(8)
  })

  it('reports the vertical room left for capping height across placements', () => {
    expect(computePosition(reference, size, 'bottom', options).available).toBe(452)
    expect(computePosition(reference, size, 'top', options).available).toBe(284)
    // side placements span the viewport vertically rather than being capped by horizontal space
    expect(computePosition({ ...reference, x: 20 }, size, 'left', options).available).toBe(784)
    expect(computePosition({ ...reference, x: 880 }, size, 'right', options).available).toBe(784)
    // offscreen triggers still cap available height to the viewport
    expect(computePosition({ ...reference, y: 900 }, size, 'top', options).available).toBe(784)
  })
})

describe('useFloating', () => {
  it('measures natural height without stale available cap when flipping', async () => {
    const scope = effectScope()
    const open = ref(false)
    const anchor = document.createElement('button')
    const panel = document.createElement('div')

    let anchorY = 740
    anchor.getBoundingClientRect = () =>
      ({
        x: 40,
        y: anchorY,
        top: anchorY,
        left: 40,
        width: 100,
        height: 32,
        right: 140,
        bottom: anchorY + 32,
        toJSON: () => ({}),
      }) as DOMRect

    // Simulate CSS clamping height to `--dou-floating-available` when present.
    const naturalHeight = 220
    Object.defineProperty(panel, 'offsetWidth', { configurable: true, get: () => 260 })
    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      get: () => {
        const cap = parseFloat(panel.style.getPropertyValue('--dou-floating-available'))
        return Number.isFinite(cap) ? Math.min(naturalHeight, cap) : naturalHeight
      },
    })

    const originalClientHeight = Object.getOwnPropertyDescriptor(
      document.documentElement,
      'clientHeight',
    )
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      document.documentElement,
      'clientWidth',
    )
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      get: () => 1000,
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      get: () => 800,
    })

    try {
      const floating = scope.run(() =>
        useFloating(() => anchor, ref<HTMLElement | null>(panel), {
          open,
          placement: 'bottom-start',
        }),
      )!

      // Pre-seed a tight cap as if previously measured near the bottom edge.
      panel.style.setProperty('--dou-floating-available', '12px')
      open.value = true
      await nextTick()

      // Must ignore the stale 12px cap, see the real 220px height and flip above.
      expect(floating.placement.value).toBe('top-start')
      expect(floating.style.value['--dou-floating-available' as never]).toBe('724px')
      expect(floating.style.value.top).toBe(`${740 - 220 - 8}px`)

      // When `display: none` is still set (e.g. before Transition reveals), keep
      // the previous valid position rather than measuring 0x0.
      anchorY = 740
      panel.style.display = 'none'
      floating.update()
      expect(floating.placement.value).toBe('top-start')
    } finally {
      scope.stop()
      if (originalClientHeight)
        Object.defineProperty(document.documentElement, 'clientHeight', originalClientHeight)
      if (originalClientWidth)
        Object.defineProperty(document.documentElement, 'clientWidth', originalClientWidth)
    }
  })
})
