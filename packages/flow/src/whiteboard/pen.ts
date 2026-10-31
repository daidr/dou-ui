import type { FlowEditorContext } from '../context'
import type { FlowPressHandler } from '../core/extension'
import { createId, type Point } from '../core/model'
import { format } from '../locale'
import { follow, inkHit, strokeNode, type InkPoint } from './ink'
import { boardState } from './state'

/** The points of a pointer event, with the ones the browser merged into it. */
function samples(ctx: FlowEditorContext, event: PointerEvent): InkPoint[] {
  const merged = event.getCoalescedEvents?.() ?? []
  return (merged.length ? merged : [event]).map((e) => ({
    ...ctx.toCanvas({ x: e.clientX, y: e.clientY }),
    // only a pen tells pressure apart; a mouse or finger draws the plain width
    pressure: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5,
  }))
}

/** Draws a stroke with the pen; it becomes an `ink` node once let go. */
export function drawInk(ctx: FlowEditorContext, event: PointerEvent): FlowPressHandler {
  const state = boardState(ctx)
  const gap = 1 / ctx.viewport.value.zoom
  const points: InkPoint[] = []
  for (const point of samples(ctx, event)) follow(points, point, gap)
  state.ink.value = [...points]
  return {
    move(_, e) {
      for (const point of samples(ctx, e)) follow(points, point, gap)
      state.ink.value = [...points]
    },
    end(_, e) {
      state.ink.value = null
      // the lag that smooths the line stops short of where it was let go
      const [last] = samples(ctx, e).slice(-1)
      const tail = points[points.length - 1]
      if (last && tail && Math.hypot(last.x - tail.x, last.y - tail.y) >= gap) points.push(last)
      const node = strokeNode(createId(), points)
      ctx.transact((tr) => tr.addNode(node))
      ctx.announce(format(ctx.messages.value.added, { node: ctx.messages.value.board.ink }))
    },
    cancel() {
      state.ink.value = null
    },
  }
}

/** Wipes the strokes the eraser passes over; they go once it lets go. */
export function erase(ctx: FlowEditorContext, start: Point): FlowPressHandler {
  const state = boardState(ctx)
  const radius = 8 / ctx.viewport.value.zoom
  const touched = new Set<string>()
  const at = (point: Point) => {
    state.eraser.value = point
    let changed = false
    for (const node of ctx.doc.value.nodes) {
      if (node.type !== 'ink' || node.locked || touched.has(node.id)) continue
      if (!inkHit(node, point, radius)) continue
      touched.add(node.id)
      changed = true
    }
    if (changed) state.erasing.value = new Set(touched)
  }
  // between two samples, so a quick swipe misses nothing
  let last = start
  const sweep = (point: Point) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(point.x - last.x, point.y - last.y) / radius))
    for (let i = 1; i <= steps; i++)
      at({
        x: last.x + ((point.x - last.x) * i) / steps,
        y: last.y + ((point.y - last.y) * i) / steps,
      })
    last = point
  }
  at(start)
  const clear = () => {
    state.eraser.value = null
    state.erasing.value = new Set()
  }
  return {
    move: sweep,
    end() {
      clear()
      if (!touched.size) return
      ctx.transact((tr) => {
        for (const id of touched) tr.removeNode(id)
      })
      ctx.announce(format(ctx.messages.value.board.erased, { count: touched.size }))
    },
    cancel: clear,
  }
}
