import { onBeforeUnmount, ref, type Ref } from 'vue'
import type { FlowEditorContext } from '../context'
import type { FlowNode, Point } from '../core/model'
import { format } from '../locale'
import { turn } from './ink'

/** Degrees in `[0, 360)`, rounded to a whole degree. */
export const normalizeAngle = (degrees: number) => ((Math.round(degrees) % 360) + 360) % 360

/** Where a turn lands: a multiple of 15° with Shift; near a right angle, the right angle. */
export function snapAngle(degrees: number, shift: boolean) {
  if (shift) return normalizeAngle(Math.round(degrees / 15) * 15)
  const right = Math.round(degrees / 90) * 90
  return normalizeAngle(Math.abs(degrees - right) < 4 ? right : degrees)
}

/** A resize handle: the side or corner it sits on, `-1`, `0` or `1` along each axis. */
export interface ResizeHandle {
  x: -1 | 0 | 1
  y: -1 | 0 | 1
}

/** The eight handles, corners first. */
export const RESIZE_HANDLES: readonly ResizeHandle[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

/**
 * The box a node gets when `handle` is dragged by `delta` (canvas units),
 * turned by `rotation` or not: it grows along the node's own axes, and the
 * corner or side across from the handle stays where it is. With `keepRatio`
 * a corner keeps the box's proportions.
 */
export function resizeBox(
  start: { x: number; y: number; width: number; height: number },
  rotation: number,
  handle: ResizeHandle,
  delta: Point,
  min: { width: number; height: number },
  keepRatio = false,
) {
  const local = turn(delta, { x: 0, y: 0 }, -rotation)
  let width = handle.x ? Math.max(min.width, start.width + handle.x * local.x) : start.width
  let height = handle.y ? Math.max(min.height, start.height + handle.y * local.y) : start.height
  if (keepRatio && handle.x && handle.y && start.width && start.height) {
    // the larger of the two stretches, but no smaller than the least size
    const scale = Math.max(
      width / start.width,
      height / start.height,
      min.width / start.width,
      min.height / start.height,
    )
    width = start.width * scale
    height = start.height * scale
  }
  const centre = { x: start.x + start.width / 2, y: start.y + start.height / 2 }
  // the point across from the handle, on screen, stays put
  const across = (w: number, h: number) =>
    turn({ x: (-handle.x * w) / 2, y: (-handle.y * h) / 2 }, { x: 0, y: 0 }, rotation)
  const from = across(start.width, start.height)
  const to = across(width, height)
  const next = { x: centre.x + from.x - to.x, y: centre.y + from.y - to.y }
  return { x: next.x - width / 2, y: next.y - height / 2, width, height }
}

type Drag = (event: PointerEvent) => void

/**
 * Follows a pointer from a handle until it lets go: `move` on each step,
 * `end` when let go, `cancel` on Escape or when the pointer is lost.
 * Returns a function that cancels it.
 */
function follow(event: PointerEvent, move: Drag, end: Drag, cancel: () => void) {
  const el = event.currentTarget as HTMLElement
  el.setPointerCapture?.(event.pointerId)
  const id = event.pointerId
  const stop = () => {
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey, true)
  }
  const onMove = (e: PointerEvent) => e.pointerId === id && move(e)
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    stop()
    end(e)
  }
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    stop()
    cancel()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    stop()
    cancel()
  }
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey, true)
  return () => {
    stop()
    cancel()
  }
}

/**
 * The turn and corner handles of a board node. While a handle is dragged
 * the node only looks changed (`turning`, `sizing`); the document changes
 * once, when it is let go.
 */
export function useTransformHandles(
  ctx: FlowEditorContext,
  node: Ref<FlowNode>,
  rotation: Ref<number>,
  min: { width: number; height: number },
) {
  const turning = ref<number | null>(null)
  const sizing = ref<{ x: number; y: number; width: number; height: number } | null>(null)
  let abort: (() => void) | null = null
  onBeforeUnmount(() => abort?.())

  const rectOf = () => {
    const rect = ctx.getNodeRect(node.value.id)
    return rect ?? { x: node.value.x, y: node.value.y, width: 0, height: 0 }
  }

  function startTurn(event: PointerEvent) {
    if (ctx.readonly.value || node.value.locked || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const rect = rectOf()
    const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    abort = follow(
      event,
      (e) => {
        const p = ctx.toCanvas({ x: e.clientX, y: e.clientY })
        // the handle sits below the centre: straight down is 0°
        const degrees = (Math.atan2(p.y - centre.y, p.x - centre.x) * 180) / Math.PI - 90
        turning.value = snapAngle(degrees, e.shiftKey)
      },
      () => {
        const next = turning.value
        turning.value = null
        if (next === null || next === rotation.value) return
        ctx.transact((tr) => tr.updateData(node.value.id, { rotation: next || undefined }))
        ctx.announce(format(ctx.messages.value.board.turned, { degrees: next }))
      },
      () => (turning.value = null),
    )
  }

  /**
   * Drags `handle`. `options.keepRatio` says whether a corner keeps the
   * proportions: Shift turns it the other way. `options.widthOnly` changes
   * only the width, for text whose height follows its lines.
   */
  function startResize(
    event: PointerEvent,
    handle: ResizeHandle,
    options: { keepRatio?: boolean; widthOnly?: boolean } = {},
  ) {
    if (ctx.readonly.value || node.value.locked || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const start = { ...rectOf() }
    const from = ctx.toCanvas({ x: event.clientX, y: event.clientY })
    abort = follow(
      event,
      (e) => {
        const p = ctx.toCanvas({ x: e.clientX, y: e.clientY })
        const delta = { x: p.x - from.x, y: p.y - from.y }
        const keep = !!options.keepRatio !== e.shiftKey
        // only the width: a corner works as its side
        const along = options.widthOnly ? { x: handle.x, y: 0 as const } : handle
        sizing.value = resizeBox(start, rotation.value, along, delta, min, keep)
      },
      () => {
        const next = sizing.value
        sizing.value = null
        if (!next) return
        const patch: Partial<FlowNode> = {
          x: Math.round(next.x),
          y: Math.round(next.y),
          width: Math.round(next.width),
        }
        // text keeps no height: it follows its lines
        patch.height = options.widthOnly ? undefined : Math.round(next.height)
        ctx.transact((tr) => tr.updateNode(node.value.id, patch))
      },
      () => (sizing.value = null),
    )
  }

  return { turning, sizing, startTurn, startResize }
}
