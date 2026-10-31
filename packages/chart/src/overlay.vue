<script setup lang="ts">
import { useNamespace } from 'dou-ui'
import type { ComputedRef, VNodeChild } from 'vue'
import type { TickLabel } from './core/layout'

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
    }>
  >
  /** Where the donut's hole is, if there is one to fill. */
  hole: ComputedRef<{ left: number; top: number; width: number } | null>
  center: () => VNodeChild
}

defineOptions({ name: 'DouChartOverlay' })

const { state } = defineProps<{ state: OverlayState }>()
const ns = useNamespace('chart')
const { shown, labels, titles, legend, hole } = state
const Center = () => state.center()
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
      v-for="item in legend"
      :key="`legend:${item.index}`"
      :class="[ns.e('legend'), ns.is(item.kind), ns.is('dashed', item.dashed)]"
      :style="{ transform: `translate(${item.left}px, ${item.top}px)` }"
      ><span :class="ns.e('swatch')" :style="{ color: item.color }" /><span :class="ns.e('text')">{{
        item.text
      }}</span></span
    >
  </div>
  <div
    v-if="hole"
    :class="ns.e('center')"
    :style="{ left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.width}px` }"
  >
    <Center />
  </div>
</template>
