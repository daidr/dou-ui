import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DouImagePreview } from '../../../index'
import {
  clampOffset,
  getDoubleTapScale,
  getPanBounds,
  normalizeWheelDelta,
  rotateOffset,
  rubberband,
  rubberbandOffset,
  rubberbandScale,
  wheelScaleFactor,
  zoomAroundPoint,
} from '../viewport'

function parseTransform(transform: string) {
  const translate = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform)
  const scale = /scale\(([-\d.]+)\)/.exec(transform)
  const rotate = /rotate\(([-\d.]+)deg\)/.exec(transform)
  return {
    x: translate ? Number(translate[1]) : 0,
    y: translate ? Number(translate[2]) : 0,
    scale: scale ? Number(scale[1]) : 1,
    rotate: rotate ? Number(rotate[1]) : 0,
  }
}

function mockStageLayout(
  stage: HTMLElement,
  image: HTMLImageElement,
  options: {
    stageWidth?: number
    stageHeight?: number
    imageWidth?: number
    imageHeight?: number
  } = {},
) {
  const stageWidth = options.stageWidth ?? 800
  const stageHeight = options.stageHeight ?? 600
  const imageWidth = options.imageWidth ?? 800
  const imageHeight = options.imageHeight ?? 600
  const offsetLeft = (stageWidth - imageWidth) / 2
  const offsetTop = (stageHeight - imageHeight) / 2

  Object.defineProperty(stage, 'clientWidth', { configurable: true, value: stageWidth })
  Object.defineProperty(stage, 'clientHeight', { configurable: true, value: stageHeight })
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: stageWidth,
    bottom: stageHeight,
    width: stageWidth,
    height: stageHeight,
    toJSON: () => ({}),
  } as DOMRect)

  Object.defineProperty(image, 'offsetWidth', { configurable: true, value: imageWidth })
  Object.defineProperty(image, 'offsetHeight', { configurable: true, value: imageHeight })
  Object.defineProperty(image, 'offsetLeft', { configurable: true, value: offsetLeft })
  Object.defineProperty(image, 'offsetTop', { configurable: true, value: offsetTop })
}

function pointerEvent(
  type: string,
  init: {
    pointerId?: number
    pointerType?: string
    clientX?: number
    clientY?: number
    button?: number
    isPrimary?: boolean
  } = {},
) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'touch',
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
    isPrimary: init.isPrimary ?? false,
  })
}

function wheelEvent(
  init: {
    deltaY?: number
    deltaMode?: number
    ctrlKey?: boolean
    clientX?: number
    clientY?: number
  } = {},
) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: init.deltaY ?? 0,
    deltaMode: init.deltaMode ?? 0,
    ctrlKey: init.ctrlKey ?? false,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  })
  // happy-dom does not inherit MouseEventInit fields in WheelEvent's constructor.
  Object.defineProperty(event, 'ctrlKey', { configurable: true, value: init.ctrlKey ?? false })
  Object.defineProperty(event, 'clientX', { configurable: true, value: init.clientX ?? 0 })
  Object.defineProperty(event, 'clientY', { configurable: true, value: init.clientY ?? 0 })
  return event
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('image preview viewport math', () => {
  it('computes pan bounds for normal and quarter-turned images', () => {
    expect(getPanBounds({ width: 800, height: 600 }, { width: 800, height: 600 }, 1, 0)).toEqual({
      maxX: 0,
      maxY: 0,
    })
    expect(getPanBounds({ width: 800, height: 600 }, { width: 800, height: 600 }, 2, 0)).toEqual({
      maxX: 400,
      maxY: 300,
    })
    expect(getPanBounds({ width: 800, height: 400 }, { width: 800, height: 600 }, 1, 90)).toEqual({
      maxX: 0,
      maxY: 100,
    })
    expect(clampOffset({ x: 520, y: -420 }, { maxX: 400, maxY: 300 })).toEqual({
      x: 400,
      y: -300,
    })
  })

  it('applies monotonic bounded rubberband resistance to offset and scale', () => {
    expect(rubberband(10, -100, 100)).toBe(10)
    const slightOver = rubberband(150, -100, 100, 120)
    const farOver = rubberband(1000, -100, 100, 120)
    expect(slightOver).toBeGreaterThan(100)
    expect(slightOver).toBeLessThan(150)
    expect(farOver).toBeGreaterThan(slightOver)
    expect(farOver).toBeLessThan(220)

    const dampedOffset = rubberbandOffset({ x: 500, y: -500 }, { maxX: 400, maxY: 300 })
    expect(dampedOffset.x).toBeGreaterThan(400)
    expect(dampedOffset.x).toBeLessThan(500)
    expect(dampedOffset.y).toBeLessThan(-300)
    expect(dampedOffset.y).toBeGreaterThan(-500)

    const under = rubberbandScale(0.1, 0.25, 4)
    const over = rubberbandScale(8, 0.25, 4)
    expect(under).toBeLessThan(0.25)
    expect(under).toBeGreaterThan(0.125)
    expect(over).toBeGreaterThan(4)
    expect(over).toBeLessThan(6.4)
  })

  it('anchors zoom around a focal point and handles translating midpoint', () => {
    const offset = zoomAroundPoint({ scale: 1, offset: { x: 0, y: 0 } }, 2, { x: -120, y: 80 })
    expect(offset).toEqual({ x: 120, y: -80 })

    const panned = zoomAroundPoint(
      { scale: 1, offset: { x: 0, y: 0 } },
      2,
      { x: 100, y: 50 },
      { x: 130, y: 70 },
    )
    expect(panned).toEqual({ x: -70, y: -30 })
  })

  it('resolves double-tap target scale, wheel deltas and offset rotation', () => {
    expect(getDoubleTapScale(1, 0.25, 4)).toBe(2)
    expect(getDoubleTapScale(2, 0.25, 4)).toBe(1)
    expect(getDoubleTapScale(0.5, 0.25, 4)).toBe(1)
    expect(getDoubleTapScale(1, 1, 1.5)).toBe(1.5)

    expect(normalizeWheelDelta({ deltaY: -3, deltaMode: 1 })).toBe(-48)
    expect(wheelScaleFactor(-10, true)).toBeCloseTo(Math.exp(0.1), 5)
    expect(rotateOffset({ x: 100, y: 40 }, 90)).toEqual({ x: -40, y: 100 })
    expect(rotateOffset({ x: 100, y: 40 }, -90)).toEqual({ x: 40, y: -100 })
  })
})

async function mountPreview(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouImagePreview, {
    props: {
      open: true,
      images: ['a.png', 'b.png'],
      minScale: 0.25,
      maxScale: 4,
      ...props,
    },
    attachTo: document.body,
  })
  await nextTick()
  const root = document.querySelector<HTMLElement>('.dou-image-preview')!
  const stage = root.querySelector<HTMLElement>('.dou-image-preview__stage')!
  const image = root.querySelector<HTMLImageElement>('.dou-image-preview__image')!
  mockStageLayout(stage, image)
  image.dispatchEvent(new Event('load'))
  await nextTick()
  return { wrapper, root, stage, image }
}

describe('DouImagePreview gestures and trackpad zoom', () => {
  it('pinches around two-finger midpoint with rubberband and rebounds within bounds', async () => {
    const { wrapper, stage, image } = await mountPreview({ minScale: 0.5, maxScale: 3 })

    // Start pinch around (250, 200), which is focal (-150, -100) relative to center (400, 300).
    stage.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 200, clientY: 200, isPrimary: true }),
    )
    stage.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 2, clientX: 300, clientY: 200, isPrimary: false }),
    )
    await nextTick()
    expect(image.classList.contains('is-interacting')).toBe(true)

    // Spread fingers from distance 100 to 200 around the same midpoint (250, 200) -> 2x scale.
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 150, clientY: 200 }))
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 350, clientY: 200 }))
    await nextTick()

    let state = parseTransform(image.style.transform)
    expect(state.scale).toBeCloseTo(2, 2)
    expect(state.x).toBeCloseTo(150, 1)
    expect(state.y).toBeCloseTo(100, 1)

    // Overshoot beyond maxScale (distance 500 -> rawScale 5 > maxScale 3): damped scale > 3 and < 5.
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 200 }))
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 500, clientY: 200 }))
    await nextTick()

    state = parseTransform(image.style.transform)
    expect(state.scale).toBeGreaterThan(3)
    expect(state.scale).toBeLessThan(5)

    // Lift fingers: smoothly rebounds to maxScale (3) and clears interacting state.
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 200 }))
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 500, clientY: 200 }))
    await nextTick()

    state = parseTransform(image.style.transform)
    expect(image.classList.contains('is-interacting')).toBe(false)
    expect(state.scale).toBeCloseTo(3, 4)
    expect(Math.abs(state.x)).toBeLessThanOrEqual(800)
    expect(Math.abs(state.y)).toBeLessThanOrEqual(600)

    // Pinch below minScale (0.5): damped < 0.5 during pinch, rebounds to 0.5 with centered offset.
    stage.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 3, clientX: 100, clientY: 300, isPrimary: true }),
    )
    stage.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 4, clientX: 700, clientY: 300, isPrimary: false }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 3, clientX: 380, clientY: 300 }))
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 4, clientX: 420, clientY: 300 }))
    await nextTick()

    state = parseTransform(image.style.transform)
    expect(state.scale).toBeLessThan(0.5)
    expect(state.scale).toBeGreaterThan(0.25)

    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 3, clientX: 380, clientY: 300 }))
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 4, clientX: 420, clientY: 300 }))
    await nextTick()

    state = parseTransform(image.style.transform)
    expect(state.scale).toBeCloseTo(0.5, 4)
    expect(state.x).toBe(0)
    expect(state.y).toBe(0)
    // Mask click immediately after pinch must not close the preview.
    stage.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()

    wrapper.unmount()
  })

  it('pans with single finger when zoomed, resists past edges and rebounds on release', async () => {
    const { wrapper, stage, image } = await mountPreview()

    // Double-click center to zoom to 2x (bounds: maxX = 400, maxY = 300).
    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 400, clientY: 300 }))
    await nextTick()
    expect(parseTransform(image.style.transform).scale).toBe(2)
    expect(image.classList.contains('is-movable')).toBe(true)

    // Drag well past the right boundary (delta +550 > maxX 400).
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, isPrimary: true }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 650, clientY: 300 }))
    await nextTick()

    expect(image.classList.contains('is-dragging')).toBe(true)
    expect(image.classList.contains('is-interacting')).toBe(true)
    const duringDrag = parseTransform(image.style.transform)
    expect(duringDrag.x).toBeGreaterThan(400)
    expect(duringDrag.x).toBeLessThan(550)

    // Release: rebounds to maxX (400).
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 650, clientY: 300 }))
    await nextTick()

    expect(image.classList.contains('is-dragging')).toBe(false)
    expect(image.classList.contains('is-interacting')).toBe(false)
    expect(parseTransform(image.style.transform).x).toBe(400)

    // Clicking the mask while zoomed does not close.
    stage.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
        isPrimary: true,
      }),
    )
    stage.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 2, pointerType: 'mouse', clientX: 10, clientY: 10 }),
    )
    stage.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()

    // Double-click to return to 1x, then clicking the mask closes.
    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 400, clientY: 300 }))
    await nextTick()
    expect(parseTransform(image.style.transform).scale).toBe(1)

    stage.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 3,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
        isPrimary: true,
      }),
    )
    stage.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 3, pointerType: 'mouse', clientX: 10, clientY: 10 }),
    )
    stage.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
  })

  it('toggles zoom around tap point on touch double-tap and desktop double-click', async () => {
    vi.useFakeTimers()
    const { wrapper, stage, image } = await mountPreview()

    // Touch double-tap at (260, 220) -> focal (-140, -80) relative to (400, 300).
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 260, clientY: 220, isPrimary: true }),
    )
    vi.advanceTimersByTime(40)
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 260, clientY: 220 }))
    vi.advanceTimersByTime(120)
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 2, clientX: 264, clientY: 218, isPrimary: true }),
    )
    vi.advanceTimersByTime(40)
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 264, clientY: 218 }))
    await nextTick()

    let state = parseTransform(image.style.transform)
    expect(state.scale).toBe(2)
    expect(state.x).toBe(136)
    expect(state.y).toBe(82)

    // Synthetic dblclick immediately after touch double-tap is ignored.
    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 264, clientY: 218 }))
    await nextTick()
    expect(parseTransform(image.style.transform).scale).toBe(2)

    // Second touch double-tap returns to 1x and centers the image.
    vi.advanceTimersByTime(600)
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 3, clientX: 264, clientY: 218, isPrimary: true }),
    )
    vi.advanceTimersByTime(40)
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 3, clientX: 264, clientY: 218 }))
    vi.advanceTimersByTime(100)
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 4, clientX: 264, clientY: 218, isPrimary: true }),
    )
    vi.advanceTimersByTime(40)
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 4, clientX: 264, clientY: 218 }))
    await nextTick()

    state = parseTransform(image.style.transform)
    expect(state.scale).toBe(1)
    expect(state.x).toBe(0)
    expect(state.y).toBe(0)

    // Desktop double-click at (520, 360) -> focal (120, 60) zooms to 2x around click point.
    vi.advanceTimersByTime(600)
    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 520, clientY: 360 }))
    await nextTick()
    state = parseTransform(image.style.transform)
    expect(state.scale).toBe(2)
    expect(state.x).toBe(-120)
    expect(state.y).toBe(-60)

    wrapper.unmount()
  })

  it('supports continuous trackpad pinch (ctrlKey wheel) around cursor without stalling', async () => {
    vi.useFakeTimers()
    const { wrapper, stage, image } = await mountPreview()

    // Stream of tiny fractional ctrlKey wheel deltas around (300, 250) -> focal (-100, -50).
    for (let i = 0; i < 20; i++) {
      stage.dispatchEvent(
        wheelEvent({
          ctrlKey: true,
          deltaY: -0.4,
          clientX: 300,
          clientY: 250,
        }),
      )
    }
    await nextTick()

    expect(image.classList.contains('is-interacting')).toBe(true)
    const zoomed = parseTransform(image.style.transform)
    expect(zoomed.scale).toBeCloseTo(Math.exp(20 * 0.4 * 0.01), 3)
    expect(zoomed.x).toBeGreaterThan(0)
    expect(zoomed.y).toBeGreaterThan(0)

    // After wheel stream idles, interacting flag clears.
    vi.advanceTimersByTime(150)
    await nextTick()
    expect(image.classList.contains('is-interacting')).toBe(false)

    // Zooming back out clamps cleanly to minScale and resets offset to (0, 0).
    for (let i = 0; i < 40; i++) {
      stage.dispatchEvent(
        wheelEvent({
          ctrlKey: true,
          deltaY: 10,
          clientX: 300,
          clientY: 250,
        }),
      )
    }
    await nextTick()
    const minState = parseTransform(image.style.transform)
    expect(minState.scale).toBe(0.25)
    expect(minState.x).toBe(0)
    expect(minState.y).toBe(0)

    // Discrete mouse wheel step (no ctrlKey) zooms in around the cursor position.
    vi.advanceTimersByTime(150)
    wrapper.setProps({ index: 1 })
    await nextTick()
    const nextImage = document.querySelector<HTMLImageElement>('.dou-image-preview__image')!
    mockStageLayout(stage, nextImage)
    nextImage.dispatchEvent(new Event('load'))
    await nextTick()

    stage.dispatchEvent(
      wheelEvent({
        ctrlKey: false,
        deltaY: -100,
        clientX: 300,
        clientY: 250,
      }),
    )
    await nextTick()
    const stepped = parseTransform(nextImage.style.transform)
    expect(stepped.scale).toBe(1.25)
    expect(stepped.x).toBeCloseTo(25, 1)
    expect(stepped.y).toBeCloseTo(12.5, 1)

    wrapper.unmount()
  })

  it('settles cleanly if the window loses focus mid-drag', async () => {
    const { wrapper, stage, image } = await mountPreview()

    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 400, clientY: 300 }))
    await nextTick()

    image.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 200,
        clientY: 300,
        isPrimary: true,
      }),
    )
    stage.dispatchEvent(
      pointerEvent('pointermove', {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 800,
        clientY: 300,
      }),
    )
    await nextTick()
    expect(image.classList.contains('is-dragging')).toBe(true)
    expect(parseTransform(image.style.transform).x).toBeGreaterThan(400)

    window.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(image.classList.contains('is-dragging')).toBe(false)
    expect(image.classList.contains('is-interacting')).toBe(false)
    expect(parseTransform(image.style.transform).x).toBe(400)

    wrapper.unmount()
  })
})
