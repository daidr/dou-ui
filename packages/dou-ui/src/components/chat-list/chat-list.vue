<script setup lang="ts" generic="T">
import { ArrowDownIcon } from '@dou-ui/icons'
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { DouVirtualList } from '../virtual-list'
import type { VirtualListExpose } from '../virtual-list'
import { useReducedMotion } from '../../composables/use-motion'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { ChatListEmits, ChatListExpose, ChatListProps, ChatListSlots } from './chat-list'

defineOptions({ name: 'DouChatList' })

const props = withDefaults(defineProps<ChatListProps<T>>(), {
  autoScroll: true,
  threshold: 24,
  showScrollButton: true,
  items: undefined,
  itemKey: undefined,
  estimateSize: 120,
})
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
watch(atBottom, (value) => emit('update:atBottom', value))

// Following is a decision of the reader: scrolling up turns it off,
// reaching the bottom turns it on again. Growing content alone never
// changes it.
let following = true
let lastTop = 0
let atTop = false

function distanceToBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

function onScroll() {
  const el = viewportRef.value
  if (!el) return
  const near = distanceToBottom(el) <= props.threshold
  if (near) following = true
  else if (el.scrollTop < lastTop) following = false
  lastTop = el.scrollTop
  atBottom.value = near
  const top = el.scrollTop <= 0 && el.scrollHeight > el.clientHeight
  if (top && !atTop) emit('topReached')
  atTop = top
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

defineExpose<ChatListExpose>({
  get viewport() {
    return viewportRef.value
  },
  scrollToBottom,
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
