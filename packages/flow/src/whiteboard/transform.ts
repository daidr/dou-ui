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

/**
 * The box a turned node gets when its corner handle is dragged by `delta`
 * (canvas units): the size grows along the node's own axes, and the corner
 * across from the handle stays where it is.
 */
export function resizeTurned(
  start: { x: number; y: number; width: number; height: number },
  rotation: number,
  delta: Point,
  min: { width: number; height: number },
) {
  const local = turn(delta, { x: 0, y: 0 }, -rotation)
  const width = Math.max(min.width, start.width + local.x)
  const height = Math.max(min.height, start.height + local.y)
  const centre = { x: start.x + start.width / 2, y: start.y + start.height / 2 }
  // the top left corner, on screen, stays put
  const corner = turn({ x: start.x, y: start.y }, centre, rotation)
  const offset = turn({ x: width / 2, y: height / 2 }, { x: 0, y: 0 }, rotation)
  const next = { x: corner.x + offset.x, y: corner.y + offset.y }
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

  function startResize(event: PointerEvent) {
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
        sizing.value = resizeTurned(start, rotation.value, delta, min)
      },
      () => {
        const next = sizing.value
        sizing.value = null
        if (!next) return
        ctx.transact((tr) =>
          tr.updateNode(node.value.id, {
            x: Math.round(next.x),
            y: Math.round(next.y),
            width: Math.round(next.width),
            height: Math.round(next.height),
          }),
        )
      },
      () => (sizing.value = null),
    )
  }

  return { turning, sizing, startTurn, startResize }
}
