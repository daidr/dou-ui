<script setup lang="ts" generic="T">
import type { HTMLAttributes } from 'vue'
import type { ForwardedAttributes } from '../../utils/install'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { useMeasuredSizes } from '../../composables/use-measured-sizes'
import { useNamespace } from '../../utils/namespace'
import { createOffsets } from './virtual-list'
import type {
  VirtualListAlign,
  VirtualListEmits,
  VirtualListExpose,
  VirtualListKey,
  VirtualListProps,
  VirtualListSlots,
} from './virtual-list'

defineOptions({ name: 'DouVirtualList' })

const props = withDefaults(
  defineProps<
    VirtualListProps<T> &
      /* @vue-ignore */ ForwardedAttributes<
        HTMLAttributes,
        VirtualListProps<T>,
        keyof VirtualListEmits & string
      >
  >(),
  {
    itemSize: undefined,
    estimateSize: 40,
    overscan: 4,
    endThreshold: 40,
  },
)
const emit = defineEmits<{ scroll: [event: Event]; endReached: [] }>()
defineSlots<VirtualListSlots<T>>()

// The list itself takes focus (tabindex 0) so the keyboard can scroll it.
// A parent that manages focus on its own passes `:tabindex="undefined"`.
const ns = useNamespace('virtual-list')
const elRef = useTemplateRef<HTMLElement>('el')

const sizeBy = (size: number | ((item: T, index: number) => number), index: number) =>
  typeof size === 'function' ? size(props.items[index]!, index) : size

// Without `itemSize`, heights come from the rendered items.
const measured = computed(() => props.itemSize === undefined)
const measuredSizes = useMeasuredSizes({
  count: () => props.items.length,
  keyOf: (index) => keyOf(props.items[index]!, index),
  estimate: (index) => sizeBy(props.estimateSize, index),
  container: () => elRef.value,
})
const fixedOffsets = computed(() =>
  createOffsets(props.items.length, (index) => sizeBy(props.itemSize!, index)),
)
const offsets = computed(() => (measured.value ? measuredSizes.offsets.value : fixedOffsets.value))
const sizeOf = (index: number) =>
  measured.value ? undefined : `${sizeBy(props.itemSize!, index)}px`
onUpdated(measuredSizes.prune)

const scrollTop = ref(0)
// The measured viewport, or the `height` prop until it can be measured.
const viewportSize = ref(0)
const viewport = computed(
  () => viewportSize.value || (typeof props.height === 'number' ? props.height : 0),
)

const range = computed(() => {
  const count = props.items.length
  if (!count) return { from: 0, to: 0 }
  const { find } = offsets.value
  const first = find(scrollTop.value)
  const last = find(scrollTop.value + Math.max(viewport.value, 1) - 1)
  return {
    from: Math.max(0, first - props.overscan),
    to: Math.min(count, last + 1 + props.overscan),
  }
})

const keyOf = (item: T, index: number): VirtualListKey => {
  const { itemKey } = props
  if (typeof itemKey === 'function') return itemKey(item, index)
  if (itemKey) return (item as Record<string, VirtualListKey>)[itemKey]!
  return index
}

const visible = computed(() => {
  const { from, to } = range.value
  return props.items.slice(from, to).map((item, offset) => {
    const index = from + offset
    return { item, index, key: keyOf(item, index) }
  })
})

const style = computed(() =>
  props.height === undefined
    ? undefined
    : { height: typeof props.height === 'number' ? `${props.height}px` : props.height },
)

let reachedEnd = false
function onScroll(event: Event) {
  const el = event.currentTarget as HTMLElement
  scrollTop.value = el.scrollTop
  remember(el)
  emit('scroll', event)
  const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - props.endThreshold
  if (atEnd && !reachedEnd && props.items.length) emit('endReached')
  reachedEnd = atEnd
}
// New items push the end away again.
watch(
  () => props.items.length,
  () => (reachedEnd = false),
)

// With measured items, items added or removed above the view keep the
// first visible item where it was, e.g. earlier messages loaded on top.
let anchor: { key: VirtualListKey; offset: number } | undefined
function remember(el: HTMLElement) {
  if (!measured.value || el.scrollTop <= 0 || !props.items.length) return (anchor = undefined)
  const index = offsets.value.find(el.scrollTop)
  anchor = {
    key: keyOf(props.items[index]!, index),
    offset: offsets.value.start(index) - el.scrollTop,
  }
}
watch(
  () => props.items,
  (items) => {
    const held = anchor
    if (!held || !elRef.value) return
    const index = items.findIndex((item, at) => keyOf(item, at) === held.key)
    if (index >= 0) scrollTo(Math.max(0, offsets.value.start(index) - held.offset))
  },
  { flush: 'post' },
)

const observer = shallowRef<ResizeObserver>()
onMounted(() => {
  const el = elRef.value
  if (!el) return
  viewportSize.value = el.clientHeight
  if (typeof ResizeObserver === 'undefined') return
  observer.value = new ResizeObserver(() => (viewportSize.value = el.clientHeight))
  observer.value.observe(el)
})
onBeforeUnmount(() => observer.value?.disconnect())

function scrollTo(offset: number) {
  const el = elRef.value
  if (!el) return
  el.scrollTop = offset
  // Rendering follows right away, without waiting for the scroll event.
  scrollTop.value = el.scrollTop
}

function scrollToIndex(index: number, align: VirtualListAlign = 'nearest', settle = 2) {
  if (index < 0 || index >= props.items.length) return
  // Measured items land where estimated at first; once the items around
  // the target are rendered and measured, aim again.
  if (measured.value && settle > 0 && typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => scrollToIndex(index, align, settle - 1))
  }
  const { start } = offsets.value
  const top = start(index)
  const bottom = start(index + 1)
  const height = viewport.value
  const current = scrollTop.value
  let target = current
  if (align === 'start') target = top
  else if (align === 'end') target = bottom - height
  else if (align === 'center') target = top - (height - (bottom - top)) / 2
  else if (top < current) target = top
  else if (bottom > current + height) target = bottom - height
  if (target !== current) scrollTo(Math.max(0, target))
}

defineExpose<VirtualListExpose>({
  scrollToIndex: (index, align) => scrollToIndex(index, align),
  scrollTo,
  el: () => elRef.value,
})
</script>

<template>
  <div ref="el" tabindex="0" :class="ns.b()" :style="style" @scroll="onScroll">
    <div v-if="items.length" :class="ns.e('spacer')" :style="{ height: `${offsets.total}px` }">
      <div
        v-for="entry in visible"
        :key="entry.key"
        :ref="
          measured ? (el) => measuredSizes.track(el as Element, entry.key, entry.index) : undefined
        "
        :class="ns.e('item')"
        :data-index="entry.index"
        :style="{
          transform: `translateY(${offsets.start(entry.index)}px)`,
          height: sizeOf(entry.index),
        }"
      >
        <slot :item="entry.item" :index="entry.index" />
      </div>
    </div>
    <slot v-else name="empty" />
  </div>
</template>
