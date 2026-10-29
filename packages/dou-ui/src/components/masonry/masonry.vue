<script setup lang="ts" generic="T">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import type { CSSProperties } from 'vue'
import { useBreakpoints } from '../../composables/use-breakpoints'
import { useNamespace } from '../../utils/namespace'
import type { GridGap } from '../grid/grid'
import { breakpoints, resolveResponsive } from '../grid/responsive'
import { placeItems } from './masonry'
import type {
  MasonryExpose,
  MasonryKey,
  MasonryPlacement,
  MasonryProps,
  MasonrySlots,
} from './masonry'

defineOptions({ name: 'DouMasonry' })

const props = withDefaults(defineProps<MasonryProps<T>>(), { columns: 3, gap: 'md' })
defineSlots<MasonrySlots<T>>()

const ns = useNamespace('masonry')
const screen = useBreakpoints()
const rootRef = useTemplateRef<HTMLElement>('root')

const keyOf = (item: T, index: number): MasonryKey => {
  const { itemKey } = props
  if (typeof itemKey === 'function') return itemKey(item, index)
  if (itemKey) return (item as Record<string, MasonryKey>)[itemKey]!
  return index
}

/** The column count in effect: the largest breakpoint the viewport reaches that sets one. */
const columnCount = computed(() => {
  const values = resolveResponsive(props.columns)
  let count = values.base ?? 1
  for (const name of breakpoints) {
    if (name !== 'base' && screen[name] && values[name] !== undefined) count = values[name]
  }
  return Math.max(1, Math.floor(count))
})

const scale = new Set(['sm', 'md', 'lg'])
const length = (value: GridGap) =>
  typeof value === 'number' ? `${value}px` : scale.has(value) ? `var(--dou-space-${value})` : value
const gaps = computed(() => (Array.isArray(props.gap) ? props.gap : [props.gap, props.gap]))

/*
 * Until the items are measured they flow as a plain grid, which is also
 * what server-rendered markup shows. Once measured, each one is placed
 * absolutely in its column; the DOM keeps the items' own order, so Tab
 * and screen readers follow the data, not the columns.
 */
const placements = shallowRef<MasonryPlacement[]>([])
const height = ref(0)
const ready = ref(false)

function cells() {
  const root = rootRef.value
  return root ? (Array.from(root.children) as HTMLElement[]) : []
}

let observer: ResizeObserver | undefined
const observed = new Set<Element>()

function observe(list: HTMLElement[]) {
  if (!observer) return
  for (const element of observed) {
    if (!element.isConnected) {
      observer.unobserve(element)
      observed.delete(element)
    }
  }
  for (const element of list) {
    if (!observed.has(element)) {
      observer.observe(element)
      observed.add(element)
    }
  }
}

function relayout() {
  const root = rootRef.value
  if (!root) return
  const list = cells()
  observe(list)
  const rowGap = parseFloat(getComputedStyle(root).getPropertyValue('row-gap')) || 0
  const result = placeItems(
    list.map((element) => element.offsetHeight),
    columnCount.value,
    rowGap,
  )
  placements.value = result.placements
  height.value = result.height
  ready.value = true
}

// Several changes in one frame (a batch of images loading) lay out once.
let frame = 0
function schedule() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    relayout()
  })
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(schedule)
  void nextTick(relayout)
})
// New items or a new column count: measure again once the DOM is current.
watch([() => props.items, () => props.items.length, columnCount], () => {
  if (ready.value) void nextTick(schedule)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
})

const style = computed(() => {
  const [row, column] = gaps.value
  return {
    '--dou-masonry-cols': columnCount.value,
    '--dou-masonry-row-gap': length(row!),
    '--dou-masonry-column-gap': length(column!),
    height: ready.value ? `${height.value}px` : undefined,
  } as CSSProperties
})

const itemStyle = (index: number) => {
  const place = ready.value ? placements.value[index] : undefined
  if (!place) return undefined
  return {
    '--dou-masonry-col': place.column,
    '--dou-masonry-top': `${place.top}px`,
  } as CSSProperties
}

defineExpose<MasonryExpose>({ relayout })
</script>

<template>
  <div ref="root" :class="[ns.b(), ns.is('placed', ready)]" :style="style">
    <div
      v-for="(item, index) in items"
      :key="keyOf(item, index)"
      :class="ns.e('item')"
      :style="itemStyle(index)"
    >
      <slot :item="item" :index="index" />
    </div>
  </div>
</template>
