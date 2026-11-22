import { computed, onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'
import { useResizeObserver } from '../../composables/use-element-size'
import { holdPointer } from '../../utils/pointer'
import type { PointerHold } from '../../utils/pointer'
import { clampScale, stepScale } from './preview'
import {
  clamp,
  clampOffset,
  formatTransformNumber,
  getDoubleTapScale,
  getPanBounds,
  isQuarterTurn,
  normalizeWheelDelta,
  rotateOffset,
  rubberbandOffset,
  rubberbandScale,
  wheelScaleFactor,
  zoomAroundPoint,
} from './viewport'
import type { PanBounds, Point, Size } from './viewport'

export interface UsePreviewViewportOptions {
  stageRef: Ref<HTMLElement | null>
  imageRef: Ref<HTMLImageElement | null>
  active: () => boolean
  minScale: () => number
  maxScale: () => number
}

interface ActivePointer {
  id: number
  x: number
  y: number
  pointerType: string
  hold: PointerHold
  capturedMouse: boolean
}

interface MeasuredGeometry {
  viewportSize: Size
  imageSize: Size
  origin: Point
}

interface SingleGestureStart {
  pointerId: number
  x: number
  y: number
  offset: Point
  time: number
  onImage: boolean
  pointerType: string
}

interface PinchGestureStart {
  distance: number
  midpoint: Point
  scale: number
  offset: Point
}

const DRAG_THRESHOLD = 4
const TAP_SLOP = 10
const TAP_MAX_DURATION = 300
const DOUBLE_TAP_DELAY = 300
const DOUBLE_TAP_DISTANCE = 32
const TOUCH_DBLCLICK_SUPPRESS_MS = 500
const WHEEL_IDLE_MS = 120
const ZOOM_EPSILON = 0.001

const parsePx = (value: string) => Number.parseFloat(value) || 0

export function usePreviewViewport(options: UsePreviewViewportOptions) {
  const scale = ref(1)
  const rotate = ref(0)
  const flip = ref({ x: 1, y: 1 })
  const offset = ref<Point>({ x: 0, y: 0 })
  const interacting = ref(false)
  const dragging = ref(false)

  const viewportSize = ref<Size>({ width: 0, height: 0 })
  const imageSize = ref<Size>({ width: 0, height: 0 })

  const safeMinScale = () => Math.max(0.05, options.minScale())
  const safeMaxScale = () => Math.max(safeMinScale(), options.maxScale())

  const activePointers = new Map<number, ActivePointer>()
  let mode: 'idle' | 'pending' | 'pan' | 'pinch' = 'idle'
  let singleStart: SingleGestureStart | null = null
  let pinchStart: PinchGestureStart | null = null
  let lastPinchMidpoint: Point | null = null
  let gestureGeometry: MeasuredGeometry | null = null
  let lastTouchTap: { time: number; x: number; y: number } | null = null
  let lastTouchZoomAt = 0
  let suppressMaskClick = false
  let needsSettle = false
  let wheelIdleTimer: ReturnType<typeof setTimeout> | undefined
  let blurAttached = false

  function measureGeometry(): MeasuredGeometry {
    const stage = options.stageRef.value
    const image = options.imageRef.value
    if (!stage) {
      return {
        viewportSize: { width: 0, height: 0 },
        imageSize: { width: 0, height: 0 },
        origin: { x: 0, y: 0 },
      }
    }

    const stageRect = stage.getBoundingClientRect()
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(stage) : null
    const paddingLeft = style ? parsePx(style.paddingLeft) : 0
    const paddingRight = style ? parsePx(style.paddingRight) : 0
    const paddingTop = style ? parsePx(style.paddingTop) : 0
    const paddingBottom = style ? parsePx(style.paddingBottom) : 0

    const rawWidth = stage.clientWidth || stageRect.width
    const rawHeight = stage.clientHeight || stageRect.height
    const vpWidth = Math.max(0, rawWidth - paddingLeft - paddingRight)
    const vpHeight = Math.max(0, rawHeight - paddingTop - paddingBottom)

    let imgWidth = 0
    let imgHeight = 0
    let originX = stageRect.left + paddingLeft + vpWidth / 2
    let originY = stageRect.top + paddingTop + vpHeight / 2

    if (image) {
      if (image.offsetWidth > 0 && image.offsetHeight > 0) {
        imgWidth = image.offsetWidth
        imgHeight = image.offsetHeight
        originX = stageRect.left + image.offsetLeft + imgWidth / 2
        originY = stageRect.top + image.offsetTop + imgHeight / 2
      } else {
        const imgRect = image.getBoundingClientRect()
        if (imgRect.width > 0 && imgRect.height > 0) {
          const s = Math.max(scale.value, 0.01)
          const quarter = isQuarterTurn(rotate.value)
          imgWidth = (quarter ? imgRect.height : imgRect.width) / s
          imgHeight = (quarter ? imgRect.width : imgRect.height) / s
          originX = imgRect.left + imgRect.width / 2 - offset.value.x
          originY = imgRect.top + imgRect.height / 2 - offset.value.y
        }
      }
    }

    viewportSize.value = { width: vpWidth, height: vpHeight }
    imageSize.value = { width: imgWidth, height: imgHeight }
    return {
      viewportSize: { width: vpWidth, height: vpHeight },
      imageSize: { width: imgWidth, height: imgHeight },
      origin: { x: originX, y: originY },
    }
  }

  function hasMeasuredGeometry(geometry?: MeasuredGeometry | null): boolean {
    const vp = geometry?.viewportSize ?? viewportSize.value
    const img = geometry?.imageSize ?? imageSize.value
    return vp.width > 0 && vp.height > 0 && img.width > 0 && img.height > 0
  }

  function boundsFor(
    targetScale: number,
    geometry?: MeasuredGeometry | null,
    rot = rotate.value,
  ): PanBounds {
    const vp = geometry?.viewportSize ?? viewportSize.value
    const img = geometry?.imageSize ?? imageSize.value
    return getPanBounds(img, vp, targetScale, rot)
  }

  function clampToViewport(
    targetOffset: Point,
    targetScale: number,
    geometry?: MeasuredGeometry | null,
    rot = rotate.value,
  ): Point {
    if (hasMeasuredGeometry(geometry)) {
      return clampOffset(targetOffset, boundsFor(targetScale, geometry, rot))
    }
    return targetScale <= 1 + ZOOM_EPSILON ? { x: 0, y: 0 } : targetOffset
  }

  function toFocal(clientX: number, clientY: number, geometry: MeasuredGeometry): Point {
    return {
      x: clientX - geometry.origin.x,
      y: clientY - geometry.origin.y,
    }
  }

  const canPan = computed(() => {
    if (hasMeasuredGeometry()) {
      const bounds = boundsFor(scale.value)
      return bounds.maxX > 0.5 || bounds.maxY > 0.5
    }
    return scale.value > 1 + ZOOM_EPSILON
  })

  const isZoomed = computed(() => scale.value > 1 + ZOOM_EPSILON)

  const transform = computed(
    () =>
      `translate(${formatTransformNumber(offset.value.x)}px, ${formatTransformNumber(offset.value.y)}px) ` +
      `scale(${formatTransformNumber(scale.value)}) ` +
      `scale(${flip.value.x}, ${flip.value.y}) ` +
      `rotate(${rotate.value}deg)`,
  )

  function syncBounds() {
    if (!options.active()) return
    const geometry = measureGeometry()
    if (mode === 'idle') {
      offset.value = clampToViewport(offset.value, scale.value, geometry)
    }
  }

  useResizeObserver(() => options.stageRef.value, syncBounds)

  function clearWheelTimer() {
    if (wheelIdleTimer !== undefined) {
      clearTimeout(wheelIdleTimer)
      wheelIdleTimer = undefined
    }
  }

  function attachBlur() {
    if (blurAttached || typeof window === 'undefined') return
    blurAttached = true
    window.addEventListener('blur', handleWindowBlur)
  }

  function detachBlur() {
    if (!blurAttached || typeof window === 'undefined') return
    blurAttached = false
    window.removeEventListener('blur', handleWindowBlur)
  }

  function releasePointer(entry: ActivePointer) {
    entry.hold.release()
    const stage = options.stageRef.value
    if (entry.capturedMouse && stage?.isConnected && stage.hasPointerCapture?.(entry.id)) {
      stage.releasePointerCapture(entry.id)
    }
  }

  function clearPointers() {
    for (const entry of activePointers.values()) releasePointer(entry)
    activePointers.clear()
    detachBlur()
    mode = 'idle'
    singleStart = null
    pinchStart = null
    lastPinchMidpoint = null
    gestureGeometry = null
    needsSettle = false
    interacting.value = false
    dragging.value = false
  }

  function settleViewport(geometry: MeasuredGeometry | null = gestureGeometry) {
    const measured = geometry ?? measureGeometry()
    const settledScale = clamp(scale.value, safeMinScale(), safeMaxScale())
    let nextOffset = offset.value
    if (settledScale !== scale.value) {
      const anchor = lastPinchMidpoint ?? { x: 0, y: 0 }
      nextOffset = zoomAroundPoint(
        { scale: scale.value, offset: offset.value },
        settledScale,
        anchor,
      )
    }
    scale.value = settledScale
    offset.value = clampToViewport(nextOffset, settledScale, measured)
    lastPinchMidpoint = null
  }

  function handleWindowBlur() {
    const geometry = gestureGeometry
    clearPointers()
    settleViewport(geometry)
  }

  function reset() {
    clearWheelTimer()
    clearPointers()
    lastTouchTap = null
    suppressMaskClick = false
    scale.value = 1
    rotate.value = 0
    flip.value = { x: 1, y: 1 }
    offset.value = { x: 0, y: 0 }
  }

  function zoom(direction: 1 | -1) {
    if (!options.active()) return
    clearWheelTimer()
    interacting.value = false
    lastTouchTap = null
    const geometry = measureGeometry()
    const nextScale = clampScale(stepScale(scale.value, direction), safeMinScale(), safeMaxScale())
    const nextOffset = zoomAroundPoint({ scale: scale.value, offset: offset.value }, nextScale, {
      x: 0,
      y: 0,
    })
    scale.value = nextScale
    offset.value = clampToViewport(nextOffset, nextScale, geometry)
  }

  function turn(by: number) {
    if (!options.active()) return
    clearWheelTimer()
    interacting.value = false
    lastTouchTap = null
    const nextRotate = rotate.value + by
    const geometry = measureGeometry()
    rotate.value = nextRotate
    offset.value = clampToViewport(
      rotateOffset(offset.value, by),
      scale.value,
      geometry,
      nextRotate,
    )
  }

  function mirror(axis: 'x' | 'y') {
    if (!options.active()) return
    clearWheelTimer()
    interacting.value = false
    lastTouchTap = null
    flip.value = { ...flip.value, [axis]: -flip.value[axis] }
    const nextOffset =
      axis === 'x'
        ? { x: -offset.value.x || 0, y: offset.value.y }
        : { x: offset.value.x, y: -offset.value.y || 0 }
    const geometry = measureGeometry()
    offset.value = clampToViewport(nextOffset, scale.value, geometry)
  }

  function toggleZoomAt(clientX: number, clientY: number) {
    if (!options.active()) return
    clearWheelTimer()
    interacting.value = false
    const geometry = measureGeometry()
    const targetScale = getDoubleTapScale(scale.value, safeMinScale(), safeMaxScale())
    const fitScale = clamp(1, safeMinScale(), safeMaxScale())
    if (Math.abs(targetScale - fitScale) <= ZOOM_EPSILON) {
      scale.value = targetScale
      offset.value = { x: 0, y: 0 }
      return
    }
    const focal = toFocal(clientX, clientY, geometry)
    const nextOffset = zoomAroundPoint(
      { scale: scale.value, offset: offset.value },
      targetScale,
      focal,
    )
    scale.value = targetScale
    offset.value = clampToViewport(nextOffset, targetScale, geometry)
  }

  function beginPinch() {
    const list = [...activePointers.values()]
    const p1 = list[0]
    const p2 = list[1]
    if (!p1 || !p2) return
    const geometry = gestureGeometry ?? measureGeometry()
    gestureGeometry = geometry
    p1.hold.grab()
    p2.hold.grab()
    const distance = Math.max(Math.hypot(p1.x - p2.x, p1.y - p2.y), 1)
    const midpoint = toFocal((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, geometry)
    pinchStart = {
      distance,
      midpoint,
      scale: scale.value,
      offset: { ...offset.value },
    }
    lastPinchMidpoint = midpoint
    singleStart = null
    mode = 'pinch'
    needsSettle = true
    interacting.value = true
    dragging.value = false
    suppressMaskClick = true
    lastTouchTap = null
  }

  function onPointerdown(event: PointerEvent) {
    if (!options.active()) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    clearWheelTimer()

    if (event.isPrimary && activePointers.size > 0) {
      clearPointers()
    }

    const stage = options.stageRef.value
    const hold = holdPointer(event, stage, () =>
      endPointer(event.pointerId, event.clientX, event.clientY, true),
    )
    const entry: ActivePointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
      hold,
      capturedMouse: false,
    }
    activePointers.set(event.pointerId, entry)
    attachBlur()

    if (activePointers.size === 1) {
      gestureGeometry = measureGeometry()
      suppressMaskClick = false
      mode = 'pending'
      singleStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        offset: { ...offset.value },
        time: Date.now(),
        onImage: event.target === options.imageRef.value,
        pointerType: event.pointerType,
      }
      if (event.pointerType === 'mouse' && canPan.value) {
        event.preventDefault()
      }
    } else if (activePointers.size === 2) {
      beginPinch()
    } else {
      entry.hold.grab()
    }
  }

  function onPointermove(event: PointerEvent) {
    const entry = activePointers.get(event.pointerId)
    if (!entry) return
    entry.x = event.clientX
    entry.y = event.clientY

    if (mode === 'pinch' && activePointers.size >= 2 && pinchStart) {
      const list = [...activePointers.values()]
      const p1 = list[0]!
      const p2 = list[1]!
      const geometry = gestureGeometry ?? measureGeometry()
      const distance = Math.max(Math.hypot(p1.x - p2.x, p1.y - p2.y), 1)
      const midpoint = toFocal((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, geometry)
      const rawScale = pinchStart.scale * (distance / pinchStart.distance)
      const nextScale = rubberbandScale(rawScale, safeMinScale(), safeMaxScale())
      const rawOffset = zoomAroundPoint(
        { scale: pinchStart.scale, offset: pinchStart.offset },
        nextScale,
        pinchStart.midpoint,
        midpoint,
      )
      scale.value = nextScale
      offset.value = hasMeasuredGeometry(geometry)
        ? rubberbandOffset(rawOffset, boundsFor(nextScale, geometry))
        : rawOffset
      lastPinchMidpoint = midpoint
      return
    }

    if (mode === 'pending' && singleStart && singleStart.pointerId === event.pointerId) {
      const dist = Math.hypot(event.clientX - singleStart.x, event.clientY - singleStart.y)
      if (dist <= DRAG_THRESHOLD) return
      suppressMaskClick = true
      lastTouchTap = null
      if (!canPan.value) return
      mode = 'pan'
      needsSettle = true
      interacting.value = true
      dragging.value = true
      entry.hold.grab()
      if (event.pointerType === 'mouse') {
        try {
          options.stageRef.value?.setPointerCapture?.(event.pointerId)
          entry.capturedMouse = true
        } catch {
          // pointer already released
        }
      }
    }

    if (mode === 'pan' && singleStart && singleStart.pointerId === event.pointerId) {
      const geometry = gestureGeometry ?? measureGeometry()
      const rawOffset: Point = {
        x: singleStart.offset.x + (event.clientX - singleStart.x),
        y: singleStart.offset.y + (event.clientY - singleStart.y),
      }
      offset.value = hasMeasuredGeometry(geometry)
        ? rubberbandOffset(rawOffset, boundsFor(scale.value, geometry))
        : rawOffset
    }
  }

  function endPointer(pointerId: number, clientX: number, clientY: number, canceled: boolean) {
    const entry = activePointers.get(pointerId)
    if (!entry) return
    releasePointer(entry)
    activePointers.delete(pointerId)

    if (activePointers.size >= 2) {
      beginPinch()
      return
    }

    if (activePointers.size === 1) {
      const remaining = [...activePointers.values()][0]!
      suppressMaskClick = true
      pinchStart = null
      if (canPan.value) {
        mode = 'pan'
        dragging.value = true
        singleStart = {
          pointerId: remaining.id,
          x: remaining.x,
          y: remaining.y,
          offset: { ...offset.value },
          time: Date.now(),
          onImage: false,
          pointerType: remaining.pointerType,
        }
      } else {
        mode = 'idle'
        dragging.value = false
        singleStart = null
      }
      return
    }

    detachBlur()
    const endedMode = mode
    const endedSingle = singleStart
    const shouldSettle = needsSettle
    const geometry = gestureGeometry
    mode = 'idle'
    singleStart = null
    pinchStart = null
    gestureGeometry = null
    needsSettle = false
    interacting.value = false
    dragging.value = false

    if (
      !canceled &&
      endedMode === 'pending' &&
      endedSingle &&
      endedSingle.pointerId === pointerId &&
      endedSingle.pointerType === 'touch' &&
      endedSingle.onImage
    ) {
      const now = Date.now()
      const duration = now - endedSingle.time
      const moved = Math.hypot(clientX - endedSingle.x, clientY - endedSingle.y)
      if (duration <= TAP_MAX_DURATION && moved <= TAP_SLOP) {
        if (
          lastTouchTap &&
          now - lastTouchTap.time <= DOUBLE_TAP_DELAY &&
          Math.hypot(clientX - lastTouchTap.x, clientY - lastTouchTap.y) <= DOUBLE_TAP_DISTANCE
        ) {
          lastTouchTap = null
          lastTouchZoomAt = now
          suppressMaskClick = true
          toggleZoomAt(clientX, clientY)
          return
        }
        lastTouchTap = { time: now, x: clientX, y: clientY }
        return
      }
      lastTouchTap = null
    }

    if (
      shouldSettle ||
      endedMode === 'pinch' ||
      endedMode === 'pan' ||
      scale.value < safeMinScale() ||
      scale.value > safeMaxScale()
    ) {
      settleViewport(geometry)
    }
  }

  function onPointerup(event: PointerEvent) {
    endPointer(event.pointerId, event.clientX, event.clientY, false)
  }

  function onPointercancel(event: PointerEvent) {
    endPointer(event.pointerId, event.clientX, event.clientY, true)
  }

  function onDblclick(event: MouseEvent) {
    if (!options.active()) return
    if (Date.now() - lastTouchZoomAt < TOUCH_DBLCLICK_SUPPRESS_MS) return
    toggleZoomAt(event.clientX, event.clientY)
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    if (!options.active()) return
    const delta = normalizeWheelDelta(event)
    if (delta === 0) return

    lastTouchTap = null
    const continuous = event.ctrlKey || (event.deltaMode === 0 && Math.abs(delta) < 40)
    const geometry =
      continuous && wheelIdleTimer !== undefined && gestureGeometry
        ? gestureGeometry
        : measureGeometry()

    const focal = toFocal(event.clientX, event.clientY, geometry)
    let nextScale: number

    if (continuous) {
      gestureGeometry = geometry
      interacting.value = true
      clearWheelTimer()
      wheelIdleTimer = setTimeout(() => {
        wheelIdleTimer = undefined
        interacting.value = false
        gestureGeometry = null
      }, WHEEL_IDLE_MS)
      nextScale = clamp(
        scale.value * wheelScaleFactor(delta, event.ctrlKey),
        safeMinScale(),
        safeMaxScale(),
      )
    } else {
      clearWheelTimer()
      interacting.value = false
      gestureGeometry = null
      nextScale = clampScale(
        stepScale(scale.value, delta < 0 ? 1 : -1),
        safeMinScale(),
        safeMaxScale(),
      )
    }

    const nextOffset = zoomAroundPoint(
      { scale: scale.value, offset: offset.value },
      nextScale,
      focal,
    )
    scale.value = nextScale
    offset.value = clampToViewport(nextOffset, nextScale, geometry)
  }

  function canCloseOnMask(): boolean {
    return !isZoomed.value && !suppressMaskClick
  }

  function consumeMaskClick(): boolean {
    if (suppressMaskClick) {
      suppressMaskClick = false
      return false
    }
    return !isZoomed.value
  }

  onBeforeUnmount(() => {
    clearWheelTimer()
    clearPointers()
  })

  return {
    scale,
    rotate,
    flip,
    offset,
    interacting,
    dragging,
    canPan,
    isZoomed,
    transform,
    reset,
    zoom,
    turn,
    mirror,
    syncBounds,
    canCloseOnMask,
    consumeMaskClick,
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel,
    onDblclick,
    onWheel,
  }
}
