export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface PanBounds {
  maxX: number
  maxY: number
}

export interface ViewportTransform {
  scale: number
  offset: Point
}

const OFFSET_RUBBERBAND_RANGE = 120
const OFFSET_RUBBERBAND_RESISTANCE = 0.55
const SCALE_RUBBERBAND_RESISTANCE = 0.35
const SCALE_RUBBERBAND_MAX_UNDER = Math.log(2)
const SCALE_RUBBERBAND_MAX_OVER = Math.log(1.6)
const FIT_SCALE_EPSILON = 0.01

/** Keep `value` within `[min, max]` without quantizing continuous precision. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Normalize a CSS transform number to avoid `-0` and noisy floating tails. */
export function formatTransformNumber(value: number): number {
  const rounded = Math.round(value * 10000) / 10000
  return rounded === 0 ? 0 : rounded
}

/** Whether `rotate` swaps the image's visual width and height. */
export function isQuarterTurn(rotate: number): boolean {
  return Math.abs(Math.round(rotate / 90) % 2) === 1
}

/**
 * Maximum horizontal and vertical pan offsets from the centered origin so the
 * image edges stay clamped to the viewport content area.
 */
export function getPanBounds(
  imageSize: Size,
  viewportSize: Size,
  scale: number,
  rotate = 0,
): PanBounds {
  if (
    imageSize.width <= 0 ||
    imageSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return { maxX: 0, maxY: 0 }
  }
  const quarter = isQuarterTurn(rotate)
  const scaledWidth = (quarter ? imageSize.height : imageSize.width) * scale
  const scaledHeight = (quarter ? imageSize.width : imageSize.height) * scale
  return {
    maxX: Math.max(0, (scaledWidth - viewportSize.width) / 2),
    maxY: Math.max(0, (scaledHeight - viewportSize.height) / 2),
  }
}

/** Clamp a pan offset to the symmetric viewport bounds. */
export function clampOffset(offset: Point, bounds: PanBounds): Point {
  const x = clamp(offset.x, -bounds.maxX, bounds.maxX)
  const y = clamp(offset.y, -bounds.maxY, bounds.maxY)
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y }
}

/** Smooth asymptotic damping when `value` extends past `[min, max]`. */
export function rubberband(
  value: number,
  min: number,
  max: number,
  range = OFFSET_RUBBERBAND_RANGE,
  resistance = OFFSET_RUBBERBAND_RESISTANCE,
): number {
  if (value >= min && value <= max) return value
  const over = value < min ? min - value : value - max
  const damped = range > 0 ? (resistance * over * range) / (resistance * over + range) : 0
  return value < min ? min - damped : max + damped
}

/** Apply rubberband resistance to a pan offset beyond the viewport bounds. */
export function rubberbandOffset(
  offset: Point,
  bounds: PanBounds,
  range = OFFSET_RUBBERBAND_RANGE,
): Point {
  return {
    x: rubberband(offset.x, -bounds.maxX, bounds.maxX, range),
    y: rubberband(offset.y, -bounds.maxY, bounds.maxY, range),
  }
}

/**
 * Apply logarithmic rubberband resistance when a pinch overshoots `minScale`
 * or `maxScale`, keeping the damped scale strictly positive and bounded.
 */
export function rubberbandScale(scale: number, minScale: number, maxScale: number): number {
  const safeMin = Math.max(0.05, minScale)
  const safeMax = Math.max(safeMin, maxScale)
  if (scale >= safeMin && scale <= safeMax) return scale
  const positive = Math.max(scale, safeMin * 0.05)
  if (positive < safeMin) {
    const over = Math.log(safeMin / positive)
    const damped =
      (SCALE_RUBBERBAND_RESISTANCE * over * SCALE_RUBBERBAND_MAX_UNDER) /
      (SCALE_RUBBERBAND_RESISTANCE * over + SCALE_RUBBERBAND_MAX_UNDER)
    return safeMin * Math.exp(-damped)
  }
  const over = Math.log(positive / safeMax)
  const damped =
    (SCALE_RUBBERBAND_RESISTANCE * over * SCALE_RUBBERBAND_MAX_OVER) /
    (SCALE_RUBBERBAND_RESISTANCE * over + SCALE_RUBBERBAND_MAX_OVER)
  return safeMax * Math.exp(damped)
}

/**
 * Compute the new offset when scaling from `current.scale` to `nextScale` so
 * the image pixel under `focal` moves to `nextFocal` (both relative to the
 * untransformed image center).
 */
export function zoomAroundPoint(
  current: ViewportTransform,
  nextScale: number,
  focal: Point,
  nextFocal: Point = focal,
): Point {
  if (current.scale <= 0) return { ...current.offset }
  const ratio = nextScale / current.scale
  const x = nextFocal.x - (focal.x - current.offset.x) * ratio
  const y = nextFocal.y - (focal.y - current.offset.y) * ratio
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y }
}

/**
 * Target scale for double-tap / double-click: toggle between the fit scale
 * (1, clamped to `[minScale, maxScale]`) and the zoomed scale (2x, clamped).
 */
export function getDoubleTapScale(
  currentScale: number,
  minScale: number,
  maxScale: number,
  zoomScale = 2,
): number {
  const safeMin = Math.max(0.05, minScale)
  const safeMax = Math.max(safeMin, maxScale)
  const fit = clamp(1, safeMin, safeMax)
  if (Math.abs(currentScale - fit) <= FIT_SCALE_EPSILON) {
    return clamp(Math.max(zoomScale, fit * 2), safeMin, safeMax)
  }
  return fit
}

/** Convert line/page wheel deltas to pixel-equivalent units. */
export function normalizeWheelDelta(event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  if (event.deltaMode === 1) return event.deltaY * 16
  if (event.deltaMode === 2) return event.deltaY * 100
  return event.deltaY
}

/**
 * Exponential scale multiplier for continuous trackpad pinch (`ctrlKey` wheel)
 * or smooth pixel-mode trackpad scrolling.
 */
export function wheelScaleFactor(deltaY: number, isPinch: boolean): number {
  if (isPinch) return Math.exp(-clamp(deltaY, -80, 80) * 0.01)
  return Math.exp(-clamp(deltaY, -120, 120) * 0.0025)
}

/** Turn a screen-space pan offset with a 90-degree step rotation. */
export function rotateOffset(offset: Point, degrees: number): Point {
  const turns = (((Math.round(degrees / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3
  const { x, y } = offset
  if (turns === 1) return { x: -y || 0, y: x || 0 }
  if (turns === 2) return { x: -x || 0, y: -y || 0 }
  if (turns === 3) return { x: y || 0, y: -x || 0 }
  return { x: x || 0, y: y || 0 }
}
