<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { hasHover } from '../../utils/pointer'
import ToastItem from './toast-item.vue'
import type { ToastItemLayout } from './toast-item.vue'
import type { ToastRecord } from './toast'

defineOptions({ name: 'DouToastStack' })

const props = defineProps<{
  /** Oldest first, as they were shown. */
  items: ToastRecord[]
  stacked: boolean
}>()

const emit = defineEmits<{ settled: [] }>()

const ns = useNamespace('toast')

/** Space between open toasts. */
const GAP = 8
/** How far each toast behind the newest one shows past it. */
const PEEK = 12
/** How much smaller each toast behind is. */
const SHRINK = 0.05
/** Toasts shown in a closed stack; the rest wait out of sight behind them. */
const VISIBLE = 3

const heights = reactive(new Map<number, number>())
watch(
  () => props.items.map((item) => item.id),
  (ids) => {
    for (const id of heights.keys()) if (!ids.includes(id)) heights.delete(id)
  },
)

// Open while the mouse is over the stack or focus is in it; a finger or
// pen has no hover, so a tap opens it and a tap elsewhere closes it.
const hovered = ref(false)
const focused = ref(false)
const tapped = ref(false)
const held = computed(() => hovered.value || focused.value || tapped.value)
const expanded = computed(() => !props.stacked || held.value)

const list = ref<HTMLElement>()

function onPointerEnter(event: PointerEvent) {
  if (hasHover(event.pointerType)) hovered.value = true
}
function onPointerLeave(event: PointerEvent) {
  if (hasHover(event.pointerType)) hovered.value = false
}
function onPointerDown(event: PointerEvent) {
  if (hasHover(event.pointerType) || tapped.value) return
  tapped.value = true
  document.addEventListener('pointerdown', onOutside, true)
}
function onOutside(event: PointerEvent) {
  if (list.value?.contains(event.target as Node)) return
  release()
}
function release() {
  tapped.value = false
  document.removeEventListener('pointerdown', onOutside, true)
}
onBeforeUnmount(release)

function onFocusIn() {
  focused.value = true
}
function onFocusOut(event: FocusEvent) {
  if (!list.value?.contains(event.relatedTarget as Node | null)) focused.value = false
}

// A toast closed from the keyboard takes the focus with it, and not every
// browser says so: once it is gone, check where the focus went.
function onAfterLeave() {
  if (focused.value && !list.value?.contains(document.activeElement)) focused.value = false
  if (props.items.length === 0) {
    hovered.value = false
    release()
    emit('settled')
  }
}

// A toast just added has no height yet: it is measured as it mounts,
// which makes the browser work out the styles right then. Leaving it out
// of the layout until then keeps the others where they are at that moment,
// so they move from their old places to the new ones in one transition
// rather than starting from where a height of zero would put them.
const placed = computed(() => {
  const result: { id: number; height: number }[] = []
  for (let index = props.items.length - 1; index >= 0; index--) {
    const { id } = props.items[index]!
    const height = heights.get(id)
    if (height !== undefined) result.push({ id, height })
  }
  return result
})

const layout = computed(() => {
  const result = new Map<number, ToastItemLayout>()
  const toasts = placed.value
  const front = toasts[0]?.height
  let offset = 0
  toasts.forEach(({ id, height }, index) => {
    const zIndex = toasts.length - index
    if (expanded.value) {
      result.set(id, { offset, scale: 1, height, behind: false, hidden: false, zIndex })
      offset += height + GAP
      return
    }
    // A closed stack shows the newest toast whole and the edges of the
    // ones behind it, each a little smaller, all at the newest one's height.
    const depth = Math.min(index, VISIBLE - 1)
    result.set(id, {
      offset: depth * PEEK,
      scale: 1 - Math.min(index, VISIBLE) * SHRINK,
      height: index === 0 ? height : front,
      behind: index > 0,
      hidden: index >= VISIBLE,
      zIndex,
    })
  })
  for (const { id } of props.items) {
    if (!result.has(id)) {
      const zIndex = toasts.length + 1
      result.set(id, { offset: 0, scale: 1, behind: false, hidden: false, zIndex })
    }
  }
  return result
})

const height = computed(() => {
  const toasts = placed.value
  if (expanded.value) {
    let total = 0
    for (const toast of toasts) total += toast.height + GAP
    return Math.max(0, total - GAP)
  }
  const front = toasts[0]?.height ?? 0
  return front + PEEK * Math.max(0, Math.min(toasts.length, VISIBLE) - 1)
})
</script>

<template>
  <ol
    ref="list"
    :class="[ns.e('list'), ns.is('expanded', expanded && items.length > 1)]"
    :style="{ height: `${height}px` }"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @pointerdown="onPointerDown"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <TransitionGroup name="dou-toast" @after-leave="onAfterLeave">
      <ToastItem
        v-for="item in items"
        :key="item.id"
        :toast="item"
        :layout="layout.get(item.id)!"
        :paused="held"
        @resize="heights.set(item.id, $event)"
      />
    </TransitionGroup>
  </ol>
</template>
