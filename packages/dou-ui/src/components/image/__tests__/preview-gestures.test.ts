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
    buttons?: number
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
    buttons: init.buttons ?? (type === 'pointerdown' || type === 'pointermove' ? 1 : 0),
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

  it('cleans up mouse press released outside the stage or when primary button is up', async () => {
    const { wrapper, stage, image } = await mountPreview()

    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 400, clientY: 300 }))
    await nextTick()

    // Press on stage, do not move past DRAG_THRESHOLD, release on window (e.g. over toolbar/outside).
    image.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 400,
        clientY: 300,
        buttons: 1,
        isPrimary: true,
      }),
    )
    window.dispatchEvent(
      pointerEvent('pointerup', {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 401,
        clientY: 300,
        buttons: 0,
      }),
    )
    // Hovering back across stage must not trigger sticky dragging.
    stage.dispatchEvent(
      pointerEvent('pointermove', {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 520,
        clientY: 300,
        buttons: 0,
      }),
    )
    await nextTick()
    expect(image.classList.contains('is-dragging')).toBe(false)
    expect(parseTransform(image.style.transform).x).toBe(0)

    // Even if pointerup was missed completely, mouse pointermove with buttons === 0 cleans up.
    image.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 400,
        clientY: 300,
        buttons: 1,
        isPrimary: true,
      }),
    )
    stage.dispatchEvent(
      pointerEvent('pointermove', {
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 520,
        clientY: 300,
        buttons: 0,
      }),
    )
    await nextTick()
    expect(image.classList.contains('is-dragging')).toBe(false)
    expect(parseTransform(image.style.transform).x).toBe(0)

    wrapper.unmount()
  })

  it('allows 4px–10px finger jitter during touch double-tap in both fit and zoomed states', async () => {
    vi.useFakeTimers()
    const { wrapper, stage, image } = await mountPreview()

    // First tap with 6px jitter, second tap with 7px jitter (within TAP_SLOP=10px).
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 300, clientY: 250, isPrimary: true }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 306, clientY: 250 }))
    vi.advanceTimersByTime(40)
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 306, clientY: 250 }))

    vi.advanceTimersByTime(100)
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 2, clientX: 304, clientY: 252, isPrimary: true }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 311, clientY: 252 }))
    vi.advanceTimersByTime(40)
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 311, clientY: 252 }))
    await nextTick()
    expect(parseTransform(image.style.transform).scale).toBe(2)

    // Zoomed state: double-tap with 6px jitter resets back to 1x instead of entering pan.
    vi.advanceTimersByTime(400)
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 3, clientX: 400, clientY: 300, isPrimary: true }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 3, clientX: 406, clientY: 300 }))
    vi.advanceTimersByTime(40)
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 3, clientX: 406, clientY: 300 }))

    vi.advanceTimersByTime(100)
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 4, clientX: 402, clientY: 300, isPrimary: true }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 4, clientX: 408, clientY: 300 }))
    vi.advanceTimersByTime(40)
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 4, clientX: 408, clientY: 300 }))
    await nextTick()
    expect(parseTransform(image.style.transform).scale).toBe(1)
    expect(parseTransform(image.style.transform).x).toBe(0)

    wrapper.unmount()
  })

  it('keeps continuous trackpad scroll smooth across speedups, throttles discrete wheel, and ignores wheel during active pointers', async () => {
    vi.useFakeTimers()
    const { wrapper, stage, image } = await mountPreview()

    // Start continuous pixel-mode trackpad stream with small delta, then accelerate past 40px.
    stage.dispatchEvent(wheelEvent({ ctrlKey: false, deltaY: -10, clientX: 400, clientY: 300 }))
    vi.advanceTimersByTime(16)
    stage.dispatchEvent(wheelEvent({ ctrlKey: false, deltaY: -60, clientX: 400, clientY: 300 }))
    await nextTick()
    expect(image.classList.contains('is-interacting')).toBe(true)
    const continuousScale = parseTransform(image.style.transform).scale
    expect(continuousScale).toBeCloseTo(Math.exp(70 * 0.0025), 3)

    // Wait for idle, reset, and check discrete wheel throttling (40ms).
    vi.advanceTimersByTime(150)
    document.querySelector<HTMLButtonElement>('[aria-label="还原"]')!.click()
    await nextTick()

    stage.dispatchEvent(wheelEvent({ ctrlKey: false, deltaY: -100, clientX: 400, clientY: 300 }))
    vi.advanceTimersByTime(10)
    stage.dispatchEvent(wheelEvent({ ctrlKey: false, deltaY: -100, clientX: 400, clientY: 300 }))
    await nextTick()
    expect(parseTransform(image.style.transform).scale).toBe(1.25)

    // Wheel during an active pointer drag is ignored and does not disturb interacting state.
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 400, clientY: 300, isPrimary: true }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 430, clientY: 300 }))
    await nextTick()
    expect(image.classList.contains('is-interacting')).toBe(true)
    const beforeWheel = parseTransform(image.style.transform)

    vi.advanceTimersByTime(60)
    stage.dispatchEvent(wheelEvent({ ctrlKey: false, deltaY: -100, clientX: 400, clientY: 300 }))
    await nextTick()
    expect(image.classList.contains('is-interacting')).toBe(true)
    expect(parseTransform(image.style.transform).scale).toBe(beforeWheel.scale)

    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 430, clientY: 300 }))
    wrapper.unmount()
  })

  it('transitions smoothly between over-edge single-finger pan and two-finger pinch without double rubberband jump', async () => {
    const { wrapper, stage, image } = await mountPreview()

    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 400, clientY: 300 }))
    await nextTick()

    // Single-finger drag well past right bound (maxX=400, rawOffset=550).
    image.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, isPrimary: true }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 650, clientY: 300 }))
    await nextTick()
    const overPanX = parseTransform(image.style.transform).x
    expect(overPanX).toBeGreaterThan(400)

    // Add second finger and move midpoint right by 1px with same distance -> must not jump backwards.
    stage.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 2, clientX: 750, clientY: 300, isPrimary: false }),
    )
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 651, clientY: 300 }))
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 751, clientY: 300 }))
    await nextTick()
    const afterPinchJoinX = parseTransform(image.style.transform).x
    expect(afterPinchJoinX).toBeGreaterThanOrEqual(overPanX)
    expect(afterPinchJoinX - overPanX).toBeLessThan(2)

    // Lift second finger back to single-finger pan and move right by 1px -> must not jump backwards.
    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 751, clientY: 300 }))
    stage.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 652, clientY: 300 }))
    await nextTick()
    const afterPinchLeaveX = parseTransform(image.style.transform).x
    expect(afterPinchLeaveX).toBeGreaterThanOrEqual(afterPinchJoinX)
    expect(afterPinchLeaveX - afterPinchJoinX).toBeLessThan(2)

    stage.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 652, clientY: 300 }))
    await nextTick()
    expect(parseTransform(image.style.transform).x).toBe(400)

    wrapper.unmount()
  })

  it('rotates pan offset in the matching screen direction when mirrored along one axis', async () => {
    const { wrapper, root, image } = await mountPreview()

    // Double-click at (260, 260) -> focal (-140, -40) -> 2x with offset (+140, +40).
    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 260, clientY: 260 }))
    await nextTick()
    expect(parseTransform(image.style.transform)).toMatchObject({ scale: 2, x: 140, y: 40 })

    // Horizontal mirror flips offset.x to -140, offset.y stays +40.
    root.querySelector<HTMLButtonElement>('[aria-label="水平翻转"]')!.click()
    await nextTick()
    expect(parseTransform(image.style.transform)).toMatchObject({ x: -140, y: 40 })

    // With flip = (-1, 1), rotate +90deg turns the image counter-clockwise on screen (-90deg),
    // so (-140, 40) rotates to (40, 140) rather than (-40, -140).
    root.querySelector<HTMLButtonElement>('[aria-label="向右旋转"]')!.click()
    await nextTick()
    expect(parseTransform(image.style.transform)).toMatchObject({ x: 40, y: 140, rotate: 90 })

    wrapper.unmount()
  })
})
