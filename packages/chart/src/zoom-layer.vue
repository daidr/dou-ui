<script setup lang="ts">
import { holdPointer, useNamespace, type PointerHold } from 'dou-ui'
import { computed, useTemplateRef, watchPostEffect, type ComputedRef } from 'vue'
import type { Rect } from './core/painter'

/**
 * What goes over the plot for zooming and selecting: the selection being
 * dragged or kept, and the range strip with its handles. Kept apart from
 * the chart, so a drag doesn't render the chart's slot again.
 */
export interface ZoomLayerState {
  /** The selection, in px from the chart's top left. */
  brush: ComputedRef<Rect | null>
  /** The strip, and the part of x shown (0 to 1 of the whole). */
  strip: ComputedRef<{ rect: Rect; horizontal: boolean; from: number; to: number } | null>
  /** The smallest part of x that can be shown, 0 to 1. */
  least: ComputedRef<number>
  /** How far a key moves a handle, 0 to 1. */
  step: ComputedRef<number>
  /** The x at each end, as the axis shows it. */
  texts: ComputedRef<[string, string]>
  labels: ComputedRef<[string, string]>
  /** Shows `from` to `to` (0 to 1); `settle` at the end of a drag. */
  show: (from: number, to: number, settle: boolean) => void
  /** Shows all of x. */
  reset: () => void
  /** A drag on the strip starts: the tooltip goes. */
  start: () => void
  /** What the strip's sketch is drawn from: a new value only when it has to be drawn again. */
  sketch: ComputedRef<unknown>
  /** Draws the series, small, on the strip's canvas. */
  paint: (canvas: HTMLCanvasElement) => void
}

defineOptions({ name: 'DouChartZoomLayer' })

const { state } = defineProps<{ state: ZoomLayerState }>()
const ns = useNamespace('chart')
const { brush, strip } = state
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

watchPostEffect(() => {
  // not on `strip`: moving the shown part leaves the sketch as it is
  if (canvas.value && state.sketch.value) state.paint(canvas.value)
})

const px = (r: Rect) => ({
  transform: `translate(${r.x}px, ${r.y}px)`,
  width: `${r.width}px`,
  height: `${r.height}px`,
})

/** The shown part and the dimmed parts on either side, in px. */
const parts = computed(() => {
  const s = strip.value
  if (!s) return null
  const { rect, horizontal } = s
  const length = horizontal ? rect.height : rect.width
  const start = horizontal ? rect.y : rect.x
  const a = start + s.from * length
  const b = start + s.to * length
  const stretch = (from: number, to: number): Rect =>
    horizontal
      ? { x: rect.x, y: from, width: rect.width, height: to - from }
      : { x: from, y: rect.y, width: to - from, height: rect.height }
  return {
    before: stretch(start, a),
    window: stretch(a, b),
    after: stretch(b, start + length),
    ends: [a, b] as const,
  }
})

/* dragging a handle, the shown part, or the strip around it */

type Grip = 'from' | 'to' | 'window'
let drag: {
  grip: Grip
  start: number
  from: number
  to: number
  hold: PointerHold
  id: number
} | null = null

function along(event: PointerEvent): number {
  const s = strip.value!
  const el = event.currentTarget as HTMLElement
  const box = el.closest(`.${ns.e('range')}`)!.getBoundingClientRect()
  return s.horizontal
    ? (event.clientY - box.top) / box.height
    : (event.clientX - box.left) / box.width
}

function onPointerDown(event: PointerEvent, grip: Grip | 'track') {
  if (event.button !== 0 || !strip.value) return
  event.stopPropagation()
  event.preventDefault()
  state.start()
  const s = strip.value
  let { from, to } = s
  const at = along(event)
  if (grip === 'track') {
    // a press beside the shown part moves it there, and drags it from there
    const span = to - from
    from = Math.min(Math.max(0, at - span / 2), 1 - span)
    to = from + span
    state.show(from, to, false)
    grip = 'window'
  }
  const el = event.currentTarget as HTMLElement
  const hold = holdPointer(event, el)
  hold.grab()
  try {
    el.setPointerCapture?.(event.pointerId)
  } catch {
    // the pointer is already gone
  }
  drag = { grip, start: at, from, to, hold, id: event.pointerId }
}

function onPointerMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return
  const d = along(event) - drag.start
  state.show(...moved(drag.grip, drag.from, drag.to, d), false)
}

function onPointerUp(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return
  const d = along(event) - drag.start
  const grip = drag.grip
  drag.hold.release()
  const { from, to } = drag
  drag = null
  state.show(...moved(grip, from, to, d), true)
}

function onPointerCancel() {
  drag?.hold.release()
  drag = null
}

/** `from` and `to` after `grip` moved by `d`, kept in the strip and apart by the least. */
function moved(grip: Grip, from: number, to: number, d: number): [number, number] {
  const least = state.least.value
  if (grip === 'from') return [Math.min(Math.max(0, from + d), to - least), to]
  if (grip === 'to') return [from, Math.max(Math.min(1, to + d), from + least)]
  const shift = Math.min(Math.max(d, -from), 1 - to)
  return [from + shift, to + shift]
}

/* the keys on a handle */

function onKeydown(event: KeyboardEvent, grip: 'from' | 'to') {
  const s = strip.value
  if (!s) return
  const step = state.step.value
  const keys: Record<string, number> = {
    ArrowLeft: -step,
    ArrowDown: s.horizontal ? step : -step,
    ArrowRight: step,
    ArrowUp: s.horizontal ? -step : step,
    PageDown: -step * 10,
    PageUp: step * 10,
    Home: -Infinity,
    End: Infinity,
  }
  // down a vertical strip is further along x
  if (s.horizontal) [keys.PageDown, keys.PageUp] = [step * 10, -step * 10]
  const d = keys[event.key]
  if (d === undefined) return
  event.preventDefault()
  const at = grip === 'from' ? s.from : s.to
  const next = Number.isFinite(d) ? at + d : d < 0 ? 0 : 1
  state.show(...moved(grip, s.from, s.to, next - at), true)
}

const percent = (value: number) => Math.round(value * 1000) / 10
</script>

<template>
  <div v-if="brush" :class="ns.e('brush')" :style="px(brush)" aria-hidden="true" />
  <div
    v-if="strip && parts"
    :class="[ns.e('range'), ns.is('vertical', strip.horizontal)]"
    :style="px(strip.rect)"
    @pointerdown="(e) => onPointerDown(e, 'track')"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @dblclick.stop="state.reset()"
    @click.stop
  >
    <canvas ref="canvas" :class="ns.e('range-canvas')" aria-hidden="true" />
    <div
      :class="ns.e('range-shade')"
      :style="
        px({ ...parts.before, x: parts.before.x - strip.rect.x, y: parts.before.y - strip.rect.y })
      "
    />
    <div
      :class="ns.e('range-shade')"
      :style="
        px({ ...parts.after, x: parts.after.x - strip.rect.x, y: parts.after.y - strip.rect.y })
      "
    />
    <div
      :class="ns.e('range-window')"
      :style="
        px({ ...parts.window, x: parts.window.x - strip.rect.x, y: parts.window.y - strip.rect.y })
      "
      @pointerdown="(e) => onPointerDown(e, 'window')"
    />
    <div
      v-for="(grip, i) in ['from', 'to'] as const"
      :key="grip"
      :class="[ns.e('range-handle'), ns.is(grip === 'from' ? 'start' : 'end')]"
      role="slider"
      tabindex="0"
      :aria-label="state.labels.value[i]"
      :aria-orientation="strip.horizontal ? 'vertical' : 'horizontal'"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent(grip === 'from' ? strip.from : strip.to)"
      :aria-valuetext="state.texts.value[i]"
      :style="
        strip.horizontal
          ? { transform: `translate(0, ${parts.ends[i]! - strip.rect.y}px)` }
          : { transform: `translate(${parts.ends[i]! - strip.rect.x}px, 0)` }
      "
      @pointerdown="(e) => onPointerDown(e, grip)"
      @keydown="(e) => onKeydown(e, grip)"
    />
  </div>
</template>
