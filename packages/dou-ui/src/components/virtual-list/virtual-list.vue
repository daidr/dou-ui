<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { createOffsets } from './virtual-list'
import type {
  VirtualListAlign,
  VirtualListExpose,
  VirtualListKey,
  VirtualListProps,
  VirtualListSlots,
} from './virtual-list'

defineOptions({ name: 'DouVirtualList' })

const props = withDefaults(defineProps<VirtualListProps<T>>(), {
  overscan: 4,
  endThreshold: 40,
})
const emit = defineEmits<{ scroll: [event: Event]; endReached: [] }>()
defineSlots<VirtualListSlots<T>>()

// The list itself takes focus (tabindex 0) so the keyboard can scroll it.
// A parent that manages focus on its own passes `:tabindex="null"`.
const ns = useNamespace('virtual-list')
const elRef = useTemplateRef<HTMLElement>('el')

const sizeOf = (index: number) => {
  const { itemSize } = props
  return typeof itemSize === 'function' ? itemSize(props.items[index]!, index) : itemSize
}
const offsets = computed(() => createOffsets(props.items.length, sizeOf))

const scrollTop = ref(0)
// The measured viewport, or the `height` prop until it can be measured.
const measured = ref(0)
const viewport = computed(
  () => measured.value || (typeof props.height === 'number' ? props.height : 0),
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

const observer = shallowRef<ResizeObserver>()
onMounted(() => {
  const el = elRef.value
  if (!el) return
  measured.value = el.clientHeight
  if (typeof ResizeObserver === 'undefined') return
  observer.value = new ResizeObserver(() => (measured.value = el.clientHeight))
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

function scrollToIndex(index: number, align: VirtualListAlign = 'nearest') {
  if (index < 0 || index >= props.items.length) return
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

defineExpose<VirtualListExpose>({ scrollToIndex, scrollTo, el: () => elRef.value })
</script>

<template>
  <div ref="el" tabindex="0" :class="ns.b()" :style="style" @scroll="onScroll">
    <div v-if="items.length" :class="ns.e('spacer')" :style="{ height: `${offsets.total}px` }">
      <div
        v-for="entry in visible"
        :key="entry.key"
        :class="ns.e('item')"
        :style="{
          transform: `translateY(${offsets.start(entry.index)}px)`,
          height: `${sizeOf(entry.index)}px`,
        }"
      >
        <slot :item="entry.item" :index="entry.index" />
      </div>
    </div>
    <slot v-else name="empty" />
  </div>
</template>
