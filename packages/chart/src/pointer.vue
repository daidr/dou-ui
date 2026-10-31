<script setup lang="ts">
import { useNamespace } from 'dou-ui'
import { useTemplateRef, watchPostEffect, type ComputedRef, type Ref } from 'vue'
import type { Rect } from './core/painter'
import type { ChartTooltipItem, ChartTooltipSlots } from './types'

/** What is shown for the point (or x) under the pointer. */
export interface Tip {
  title?: string
  items: ChartTooltipItem[]
  /** Where the tooltip points from, in px from the chart's top left. */
  anchor: [number, number]
  /** A hairline across the plot at the x. */
  line?: Rect
  /** A shaded band over the x's room, for bars. */
  band?: Rect
  /** Rings and dots on the points. */
  marks: Array<{ left: number; top: number; color: string; radius: number; ring: boolean }>
  /** Above the anchor rather than below, out from under a finger. */
  above?: boolean
}

export interface PointerState {
  tip: ComputedRef<Tip | null>
  /** The chart's size, to keep the tooltip inside it. */
  size: ComputedRef<{ width: number; height: number } | null>
  content: Ref<ChartTooltipSlots['default'] | undefined>
  /** Read out as the keys move. */
  live: ComputedRef<string>
}

defineOptions({ name: 'DouChartPointer' })

const { state } = defineProps<{ state: PointerState }>()
const ns = useNamespace('chart')
const { tip, live } = state
const box = useTemplateRef<HTMLElement>('box')

/** Room between the tooltip and what it points at, and the chart's edges. */
const GAP = 12
const EDGE = 4

// placed after it renders, when its size is known: beside the anchor, on whichever side has room
watchPostEffect(() => {
  const el = box.value
  const t = tip.value
  const size = state.size.value
  if (!el || !t || !size) return
  const width = el.offsetWidth
  const height = el.offsetHeight
  const [x, y] = t.anchor
  let left = x + GAP
  if (left + width > size.width - EDGE) left = x - GAP - width
  left = Math.max(EDGE, Math.min(left, size.width - EDGE - width))
  let top = t.above ? y - GAP - height : y + GAP
  if (t.above ? top < EDGE : top + height > size.height - EDGE)
    top = t.above ? y + GAP : y - GAP - height
  top = Math.max(EDGE, Math.min(top, size.height - EDGE - height))
  el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
})

const px = (r: Rect) => ({
  transform: `translate(${r.x}px, ${r.y}px)`,
  width: `${r.width}px`,
  height: `${r.height}px`,
})
</script>

<template>
  <div :class="ns.e('live')" aria-live="polite">{{ live }}</div>
  <div v-if="tip" :class="ns.e('pointer')" aria-hidden="true">
    <div v-if="tip.band" :class="ns.e('band')" :style="px(tip.band)" />
    <div v-if="tip.line" :class="ns.e('crosshair')" :style="px(tip.line)" />
    <span
      v-for="(mark, i) in tip.marks"
      :key="i"
      :class="[ns.e('mark'), ns.is('ring', mark.ring)]"
      :style="{
        transform: `translate(${mark.left - mark.radius}px, ${mark.top - mark.radius}px)`,
        width: `${mark.radius * 2}px`,
        height: `${mark.radius * 2}px`,
        color: mark.color,
      }"
    />
    <div ref="box" :class="ns.e('tooltip')">
      <component
        :is="() => state.content.value!({ title: tip!.title, items: tip!.items })"
        v-if="state.content.value"
      />
      <template v-else>
        <div v-if="tip.title" :class="ns.e('tooltip-title')">
          <span :class="ns.e('text')">{{ tip.title }}</span>
        </div>
        <div v-for="(item, i) in tip.items" :key="i" :class="ns.e('tooltip-item')">
          <span v-if="item.color" :class="ns.e('tooltip-swatch')" :style="{ color: item.color }" />
          <span :class="[ns.e('tooltip-name'), ns.e('text')]">{{ item.name }}</span>
          <span :class="[ns.e('tooltip-value'), ns.e('text')]">{{ item.text }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
