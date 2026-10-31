<script setup lang="ts">
import { DouSpinner, useNamespace, type Tone } from 'dou-ui'
import type { ComputedRef, VNodeChild } from 'vue'
import type { TickLabel } from './core/layout'
import type { MarkerLabel } from './core/marker'

/**
 * The text over the canvas: tick labels, titles, the legend and what goes
 * in a donut's hole. Kept apart from the chart, so laying it out again
 * doesn't render the chart's slot again: a part written with a new
 * function each render (`:format="(v) => …"`) would otherwise be laid out
 * again and again.
 */
export interface OverlayState {
  shown: ComputedRef<boolean>
  labels: ComputedRef<Array<TickLabel & { key: string; axis: string }>>
  titles: ComputedRef<
    Array<{ key: string; text: string; left: number; top: number; align: 'start' | 'end' }>
  >
  legend: ComputedRef<
    Array<{
      index: number
      text: string
      left: number
      top: number
      color: string
      kind: string
      dashed: boolean
      /** Turned off. */
      off: boolean
      /** The last one shown: it can't be turned off. */
      locked: boolean
    }>
  >
  /** Turns the series (or slice) at `index` on or off. */
  toggle: (index: number) => void
  /** Brings the series at `index` forward while the pointer or focus is on its entry; `null` to stop. */
  focus: (index: number | null) => void
  /** Where the donut's hole is, if there is one to fill. */
  hole: ComputedRef<{ left: number; top: number; width: number } | null>
  center: () => VNodeChild
  /** The markers' labels. */
  markers: ComputedRef<Array<MarkerLabel & { key: string; tone: Tone; backdrop: boolean }>>
  /** No series has a value: the empty message shows. */
  empty: ComputedRef<boolean>
  emptyContent: () => VNodeChild
  loading: ComputedRef<boolean>
}

defineOptions({ name: 'DouChartOverlay' })

const { state } = defineProps<{ state: OverlayState }>()
const ns = useNamespace('chart')
const { shown, labels, titles, legend, hole, toggle, focus, markers, empty, loading } = state
const Center = () => state.center()
const Empty = () => state.emptyContent()
// a click focuses the entry too: only keyboard focus brings its series forward
const focusVisible = (e: FocusEvent) => (e.target as Element).matches(':focus-visible')
</script>

<template>
  <div v-if="shown" :class="ns.e('labels')" aria-hidden="true">
    <span
      v-for="tick in labels"
      :key="tick.key"
      :class="[ns.e('tick'), ns.is(tick.axis), ns.is('clipped', !!tick.clipped)]"
      :style="{
        transform: `translate(${tick.left}px, ${tick.top}px)`,
        width: tick.clipped ? `${tick.width}px` : undefined,
      }"
      :title="tick.clipped ? tick.text : undefined"
      ><span :class="ns.e('text')">{{ tick.text }}</span></span
    >
    <span
      v-for="title in titles"
      :key="title.key"
      :class="[ns.e('title'), ns.is('end', title.align === 'end')]"
      :style="{ transform: `translate(${title.left}px, ${title.top}px)` }"
      ><span :class="ns.e('text')">{{ title.text }}</span></span
    >
    <span
      v-for="marker in markers"
      :key="marker.key"
      :class="[
        ns.e('marker'),
        ns.is(marker.tone),
        ns.is(marker.align),
        ns.is('backdrop', marker.backdrop),
      ]"
      :style="{ transform: `translate(${marker.left}px, ${marker.top}px)` }"
      ><span :class="ns.e('text')">{{ marker.text }}</span></span
    >
  </div>
  <div v-if="shown && legend.length" :class="ns.e('legends')">
    <button
      v-for="item in legend"
      :key="`legend:${item.index}`"
      type="button"
      :class="[
        ns.e('legend'),
        ns.is(item.kind),
        ns.is('dashed', item.dashed),
        ns.is('off', item.off),
        ns.is('locked', item.locked),
      ]"
      :style="{ transform: `translate(${item.left}px, ${item.top}px)` }"
      :aria-pressed="!item.off"
      :aria-disabled="item.locked || undefined"
      @click="toggle(item.index)"
      @pointerenter="(e) => e.pointerType !== 'touch' && !item.off && focus(item.index)"
      @pointerleave="focus(null)"
      @focus="(e) => focusVisible(e) && !item.off && focus(item.index)"
      @blur="focus(null)"
    >
      <span :class="ns.e('swatch')" :style="{ color: item.color }" /><span :class="ns.e('text')">{{
        item.text
      }}</span>
    </button>
  </div>
  <div
    v-if="hole"
    :class="ns.e('center')"
    :style="{ left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.width}px` }"
  >
    <Center />
  </div>
  <div v-if="empty" :class="ns.e('empty')"><Empty /></div>
  <Transition name="dou-fade">
    <div v-if="loading" :class="ns.e('loading')"><DouSpinner /></div>
  </Transition>
</template>
