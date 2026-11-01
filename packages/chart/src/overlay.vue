<script setup lang="ts">
import { DouSpinner, DouTooltip, useNamespace, type Tone } from 'dou-ui'
import { onBeforeUnmount, useId, type ComputedRef, type VNodeChild } from 'vue'
import type { TickLabel } from './core/layout'
import type { PlacedDataLabel } from './core/labels'
import type { LegendBox } from './core/layout'
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
      /** The room it takes, swatch and name, in px. */
      width: number
      /** Its name is cut short to the room down the side. */
      clipped?: boolean
    }>
  >
  /** Where the legend shows; its entries scroll in it when they don't all fit. */
  legendBox: ComputedRef<LegendBox | undefined>
  /** Turns the series (or slice) at `index` on or off. */
  toggle: (index: number) => void
  /** Shows only the series (or slice) at `index`, or all again. */
  isolate: (index: number) => void
  /** How to show one entry alone, read out with each entry. */
  hint: ComputedRef<string>
  /** Brings the series at `index` forward while the pointer or focus is on its entry; `null` to stop. */
  focus: (index: number | null) => void
  /** Where the donut's hole is, if there is one to fill. */
  hole: ComputedRef<{ left: number; top: number; width: number } | null>
  center: () => VNodeChild
  /** The markers' labels. */
  markers: ComputedRef<Array<MarkerLabel & { key: string; tone: Tone; backdrop: boolean }>>
  /** Data labels: values by the points and on the bars; `ink` is their color, when not the default; `full`, their text before it was cut short. */
  data: ComputedRef<Array<PlacedDataLabel & { ink?: string; width?: number; full?: string }>>
  /** Whether the data labels show (not while the series come in). */
  dataShown: ComputedRef<boolean>
  /** The series brought forward: the other series' labels are faded too. */
  dataFocus: ComputedRef<number | null>
  /** No series has a value: the empty message shows. */
  empty: ComputedRef<boolean>
  emptyContent: () => VNodeChild
  loading: ComputedRef<boolean>
}

defineOptions({ name: 'DouChartOverlay' })

const { state } = defineProps<{ state: OverlayState }>()
const ns = useNamespace('chart')
const {
  shown,
  labels,
  titles,
  legend,
  legendBox,
  hole,
  toggle,
  isolate,
  hint,
  focus,
  markers,
  data,
  dataShown,
  dataFocus,
  empty,
  loading,
} = state
const Center = () => state.center()
const hintId = useId()

/* the legend: a click turns an entry on or off; with Alt, or held down on a touch screen, it shows only that one */

/** How long a finger stays on an entry to show only it, in ms. */
const HOLD = 500
let holdTimer: ReturnType<typeof setTimeout> | undefined
/** A hold just showed one entry alone: the click that ends it isn't a toggle. */
let held = false

function holdLegend(index: number) {
  letGo()
  held = false
  holdTimer = setTimeout(() => {
    holdTimer = undefined
    held = true
    isolate(index)
  }, HOLD)
}

function letGo() {
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = undefined
}

function onLegendClick(event: MouseEvent, index: number) {
  if (held) {
    held = false
    return
  }
  if (event.altKey) isolate(index)
  else toggle(index)
}

function onLegendKey(event: KeyboardEvent, index: number) {
  if (!event.altKey || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  isolate(index)
}
/** No callout menu over an entry while it is held down. */
function noMenu(event: Event) {
  if (holdTimer || held) event.preventDefault()
}
onBeforeUnmount(letGo)
/** Room around the legend's entries in its box, so a focus ring isn't cut off where it scrolls. */
const LEGEND_PAD = 4
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
    <span
      v-for="label in data"
      :key="`data:${label.key}`"
      :class="[
        ns.e('value'),
        ns.is(label.align),
        ns.is('inside', !!label.on),
        ns.is('hidden', !dataShown),
        ns.is('faded', dataFocus !== null && dataFocus !== label.series),
        ns.is('clipped', label.width !== undefined),
      ]"
      :style="{
        transform: `translate(${label.left}px, ${label.top}px)`,
        color: label.ink,
        width: label.width === undefined ? undefined : `${label.width}px`,
      }"
      :title="label.full ?? (label.width === undefined ? undefined : label.text)"
      ><span :class="ns.e('text')">{{ label.text }}</span></span
    >
  </div>
  <div
    v-if="shown && legend.length && legendBox"
    :class="[ns.e('legends'), ns.is('scroll', legendBox.scroll)]"
    :style="{
      left: `${legendBox.x - LEGEND_PAD}px`,
      top: `${legendBox.y - LEGEND_PAD}px`,
      width: `${legendBox.width + LEGEND_PAD * 2}px`,
      height: `${legendBox.height + LEGEND_PAD * 2}px`,
    }"
  >
    <!-- a name cut short shows in full on hover and focus; on a phone the legend goes where names aren't cut -->
    <DouTooltip
      v-for="item in legend"
      :key="`legend:${item.index}`"
      :content="item.text"
      :disabled="!item.clipped"
    >
      <button
        type="button"
        :class="[
          ns.e('legend'),
          ns.is(item.kind),
          ns.is('dashed', item.dashed),
          ns.is('off', item.off),
          ns.is('locked', item.locked),
          ns.is('clipped', !!item.clipped),
        ]"
        :style="{
          transform: `translate(${item.left - legendBox.x + LEGEND_PAD}px, ${item.top - legendBox.y + LEGEND_PAD}px)`,
          width: item.clipped ? `${item.width}px` : undefined,
        }"
        :aria-pressed="!item.off"
        :aria-describedby="hintId"
        aria-keyshortcuts="Alt+Enter"
        @click="(e) => onLegendClick(e, item.index)"
        @keydown="(e) => onLegendKey(e, item.index)"
        @pointerdown="(e) => e.pointerType === 'touch' && holdLegend(item.index)"
        @pointerup="letGo"
        @pointercancel="letGo"
        @contextmenu="noMenu"
        @pointerenter="(e) => e.pointerType !== 'touch' && !item.off && focus(item.index)"
        @pointerleave="(letGo(), focus(null))"
        @focus="(e) => focusVisible(e) && !item.off && focus(item.index)"
        @blur="focus(null)"
      >
        <span :class="ns.e('swatch')" :style="{ color: item.color }" /><span
          :class="ns.e('text')"
          >{{ item.text }}</span
        >
      </button>
    </DouTooltip>
    <span :id="hintId" hidden>{{ hint }}</span>
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
