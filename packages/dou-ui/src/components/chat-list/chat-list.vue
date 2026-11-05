<script setup lang="ts" generic="T">
import type { HTMLAttributes } from 'vue'
import type { ForwardedAttributes } from '../../utils/install'
import { ArrowDownIcon } from '@dou-ui/icons'
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { DouVirtualList } from '../virtual-list'
import type { VirtualListAlign, VirtualListExpose, VirtualListKey } from '../virtual-list'
import { useReducedMotion } from '../../composables/use-motion'
import { useTouchScroll } from '../../composables/use-touch-scroll'
import { scrollPositionOf } from '../../utils/scroll'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { ChatListEmits, ChatListExpose, ChatListProps, ChatListSlots } from './chat-list'

defineOptions({ name: 'DouChatList' })

const props = withDefaults(
  defineProps<
    ChatListProps<T> &
      /* @vue-ignore */ ForwardedAttributes<
        HTMLAttributes,
        ChatListProps<T>,
        keyof ChatListEmits & string
      >
  >(),
  {
    autoScroll: true,
    threshold: 24,
    showScrollButton: true,
    items: undefined,
    itemKey: undefined,
    estimateSize: 120,
  },
)
const emit = defineEmits<ChatListEmits>()
defineSlots<ChatListSlots<T>>()

const ns = useNamespace('chat-list')
const reducedMotion = useReducedMotion()
const { t } = useLocale()

const plainViewport = useTemplateRef<HTMLElement>('viewport')
const plainContent = useTemplateRef<HTMLElement>('content')
const listRef = useTemplateRef<VirtualListExpose>('list')
// With `items`, the virtual list scrolls and its spacer holds the content.
const viewportRef = {
  get value() {
    return props.items ? (listRef.value?.el() ?? null) : plainViewport.value
  },
}
const contentRef = {
  get value() {
    return props.items
      ? (viewportRef.value?.firstElementChild as HTMLElement | null | undefined)
      : plainContent.value
  },
}

const atBottom = ref(true)
watch(atBottom, (value) => emit('atBottomChange', value))

// Following is a decision of the reader: scrolling up turns it off,
// reaching the bottom turns it on again. Growing content alone never
// changes it.
let following = true
let lastTop = 0
let atTop = false
const touch = useTouchScroll()

function distanceToBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

const isTop = (el: HTMLElement) =>
  scrollPositionOf(el).top <= 0 && el.scrollHeight > el.clientHeight

function onScroll() {
  const el = viewportRef.value
  if (!el) return
  const near = distanceToBottom(el) <= props.threshold
  if (near) following = true
  else if (el.scrollTop < lastTop) following = false
  lastTop = el.scrollTop
  atBottom.value = near
  if (!isTop(el)) {
    atTop = false
    setTopAnchor(el, undefined)
  } else if (!atTop) touch.whenSettled(reachTop)
}

// Earlier messages loaded on top keep what is in view where it was. On iOS
// the top is reached while the content still bounces; a position written
// then is dropped, so `topReached` waits until the scroll is over.
function reachTop() {
  const el = viewportRef.value
  if (!el || atTop || !isTop(el)) return
  atTop = true
  // the virtual list keeps its own first item in place
  if (!props.items) setTopAnchor(el, anchorOf())
  emit('topReached')
}

/** The first message, and how far it is from the top of the messages. */
let topAnchor: { node: Element; y: number } | undefined
/** Kept by hand while it lasts, so the browser's own anchoring can't add to it. */
function setTopAnchor(el: HTMLElement, anchor: typeof topAnchor) {
  topAnchor = anchor
  el.style.overflowAnchor = anchor ? 'none' : ''
}

const offsetOf = (node: Element, content: Element) =>
  node.getBoundingClientRect().top - content.getBoundingClientRect().top

function anchorOf() {
  const content = contentRef.value
  const node = content?.firstElementChild
  return content && node ? { node, y: offsetOf(node, content) } : undefined
}

function keepTopAnchor() {
  const content = contentRef.value
  if (!content || !topAnchor?.node.isConnected) return
  const y = offsetOf(topAnchor.node, content)
  const shift = y - topAnchor.y
  if (Math.abs(shift) < 1) return
  topAnchor.y = y
  const el = viewportRef.value
  // a move iOS drops during a touch scroll is made once it is over
  if (el) touch.shiftScroll(el, shift)
}

function onWheel(event: WheelEvent) {
  // a wheel turn upwards stops following at once, even mid smooth-scroll
  if (event.deltaY < 0) following = false
}

function scrollToBottom(behavior: ScrollBehavior = reducedMotion.value ? 'auto' : 'smooth') {
  const el = viewportRef.value
  if (!el) return
  following = true
  el.scrollTo?.({ top: el.scrollHeight, behavior })
  if (!el.scrollTo) el.scrollTop = el.scrollHeight
}

function follow() {
  const el = viewportRef.value
  if (el && !props.items) keepTopAnchor()
  if (!el || !props.autoScroll || !following) {
    if (el) atBottom.value = distanceToBottom(el) <= props.threshold
    return
  }
  el.scrollTop = el.scrollHeight
  lastTop = el.scrollTop
  atBottom.value = true
}

let observer: ResizeObserver | undefined
onMounted(() => {
  follow()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(follow)
  observeContent()
  if (viewportRef.value) observer.observe(viewportRef.value)
})
onBeforeUnmount(() => observer?.disconnect())

// A virtual list draws its content only once it has items.
let observed: HTMLElement | null | undefined
function observeContent() {
  const content = contentRef.value
  if (!observer || content === observed) return
  if (observed) observer.unobserve(observed)
  observed = content
  if (content) observer.observe(content)
}
watch(() => props.items?.length, observeContent, { flush: 'post' })

function keyOf(item: T, index: number): VirtualListKey {
  const { itemKey } = props
  if (typeof itemKey === 'function') return itemKey(item, index)
  if (itemKey) return (item as Record<string, VirtualListKey>)[itemKey]!
  return index
}

function scrollToMessage(target: VirtualListKey | HTMLElement, align: VirtualListAlign = 'center') {
  // the reader asked to look elsewhere: new content must not pull them away
  following = false
  if (typeof target === 'object') {
    const el = viewportRef.value
    if (!el || !el.contains(target)) return
    const box = el.getBoundingClientRect()
    const item = target.getBoundingClientRect()
    const top = item.top - box.top + el.scrollTop
    const offsets = { start: top, end: top + item.height - el.clientHeight }
    let to = top - (el.clientHeight - item.height) / 2
    if (align === 'start') to = offsets.start
    else if (align === 'end') to = offsets.end
    else if (align === 'nearest')
      to =
        item.top < box.top ? offsets.start : item.bottom > box.bottom ? offsets.end : el.scrollTop
    const behavior = reducedMotion.value ? 'auto' : 'smooth'
    if (el.scrollTo) el.scrollTo({ top: Math.max(0, to), behavior })
    else el.scrollTop = Math.max(0, to)
    return
  }
  const index = props.items?.findIndex((item, at) => keyOf(item, at) === target) ?? -1
  if (index >= 0) listRef.value?.scrollToIndex(index, align)
}

defineExpose<ChatListExpose>({
  get viewport() {
    return viewportRef.value
  },
  scrollToBottom,
  scrollToMessage,
  get atBottom() {
    return atBottom.value
  },
})
</script>

<template>
  <div :class="[ns.b(), ns.is('at-bottom', atBottom), ns.is('virtual', !!items)]">
    <DouVirtualList
      v-if="items"
      ref="list"
      :class="ns.e('viewport')"
      :items="items"
      :item-key="itemKey"
      :estimate-size="estimateSize"
      role="log"
      :aria-label="t('chat.messages')"
      @scroll.passive="onScroll"
      @wheel.passive="onWheel"
    >
      <template #default="{ item, index }">
        <slot name="item" :item="item" :index="index" />
      </template>
    </DouVirtualList>
    <div
      v-else
      ref="viewport"
      :class="ns.e('viewport')"
      role="log"
      tabindex="0"
      :aria-label="t('chat.messages')"
      @scroll.passive="onScroll"
      @wheel.passive="onWheel"
    >
      <div ref="content" :class="ns.e('content')"><slot /></div>
    </div>
    <Transition name="dou-chat-list-button">
      <div v-if="showScrollButton && !atBottom" :class="ns.e('scroll')">
        <slot name="button" :scroll-to-bottom="() => scrollToBottom()">
          <button
            type="button"
            :class="ns.e('scroll-button')"
            :aria-label="t('chat.scrollToBottom')"
            @click="scrollToBottom()"
          >
            <ArrowDownIcon />
          </button>
        </slot>
      </div>
    </Transition>
  </div>
</template>
