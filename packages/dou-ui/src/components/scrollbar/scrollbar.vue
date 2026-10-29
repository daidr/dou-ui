<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { ScrollbarExpose, ScrollbarProps, ScrollbarSlots } from './scrollbar'

defineOptions({ name: 'DouScrollbar' })

const props = withDefaults(defineProps<ScrollbarProps>(), { always: false })
const emit = defineEmits<{ scroll: [position: { scrollTop: number; scrollLeft: number }] }>()
defineSlots<ScrollbarSlots>()

const ns = useNamespace('scrollbar')
const wrapRef = useTemplateRef<HTMLElement>('wrap')
const viewRef = useTemplateRef<HTMLElement>('view')
const barY = useTemplateRef<HTMLElement>('barY')
const barX = useTemplateRef<HTMLElement>('barX')

/** The least length of a thumb, so a long page still leaves something to grab. */
const MIN_THUMB = 24

const size = (value: number | string | undefined) =>
  typeof value === 'number' ? `${value}px` : value

interface Axis {
  /** Thumb length and offset along its track, in px. */
  size: number
  offset: number
  /** Whether there is anything to scroll. */
  active: boolean
}
const y = reactive<Axis>({ size: 0, offset: 0, active: false })
const x = reactive<Axis>({ size: 0, offset: 0, active: false })

function measure(axis: Axis, track: number, client: number, total: number, scrolled: number) {
  axis.active = total - client > 1
  if (!axis.active || track <= 0) return
  axis.size = Math.max(MIN_THUMB, Math.round((client / total) * track))
  const room = total - client
  axis.offset = Math.round((scrolled / room) * (track - axis.size))
}

function update() {
  const wrap = wrapRef.value
  if (!wrap) return
  measure(y, barY.value?.clientHeight ?? 0, wrap.clientHeight, wrap.scrollHeight, wrap.scrollTop)
  measure(x, barX.value?.clientWidth ?? 0, wrap.clientWidth, wrap.scrollWidth, wrap.scrollLeft)
}

let frame = 0
const schedule = () => {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    update()
  })
}

// The bars show while scrolling and fade a moment after it stops.
const scrolling = ref(false)
let idle: ReturnType<typeof setTimeout> | undefined

function onScroll() {
  const wrap = wrapRef.value!
  schedule()
  scrolling.value = true
  clearTimeout(idle)
  idle = setTimeout(() => (scrolling.value = false), 900)
  emit('scroll', { scrollTop: wrap.scrollTop, scrollLeft: wrap.scrollLeft })
}

let observer: ResizeObserver | undefined
onMounted(() => {
  update()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(schedule)
  observer.observe(wrapRef.value!)
  observer.observe(viewRef.value!)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(idle)
  if (frame) cancelAnimationFrame(frame)
})

// Dragging a thumb moves the content by as much as the thumb moved,
// scaled up by how much longer the content is than the track.
const dragging = ref<'x' | 'y' | null>(null)
let start = { pointer: 0, scroll: 0 }

function onThumbDown(event: PointerEvent, which: 'x' | 'y') {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  const wrap = wrapRef.value!
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  dragging.value = which
  start = {
    pointer: which === 'y' ? event.clientY : event.clientX,
    scroll: which === 'y' ? wrap.scrollTop : wrap.scrollLeft,
  }
}

function onThumbMove(event: PointerEvent) {
  const which = dragging.value
  const wrap = wrapRef.value
  if (!which || !wrap) return
  const vertical = which === 'y'
  const track = (vertical ? barY.value?.clientHeight : barX.value?.clientWidth) ?? 0
  const axis = vertical ? y : x
  const room = vertical
    ? wrap.scrollHeight - wrap.clientHeight
    : wrap.scrollWidth - wrap.clientWidth
  const free = track - axis.size
  if (free <= 0) return
  const moved = (vertical ? event.clientY : event.clientX) - start.pointer
  const next = start.scroll + (moved / free) * room
  if (vertical) wrap.scrollTop = next
  else wrap.scrollLeft = next
}

function onThumbUp() {
  dragging.value = null
}

// Pressing the track away from the thumb jumps there, centering the thumb on the press.
function onTrackDown(event: PointerEvent, which: 'x' | 'y') {
  if (event.button !== 0) return
  const wrap = wrapRef.value
  const bar = which === 'y' ? barY.value : barX.value
  if (!wrap || !bar) return
  const box = bar.getBoundingClientRect()
  const vertical = which === 'y'
  const axis = vertical ? y : x
  const track = vertical ? box.height : box.width
  const at = (vertical ? event.clientY - box.top : event.clientX - box.left) - axis.size / 2
  const ratio = Math.min(1, Math.max(0, at / (track - axis.size)))
  const room = vertical
    ? wrap.scrollHeight - wrap.clientHeight
    : wrap.scrollWidth - wrap.clientWidth
  wrap.scrollTo({ [vertical ? 'top' : 'left']: ratio * room })
}

const rootStyle = computed(() => ({ height: size(props.height) }))
const wrapStyle = computed(() => ({ maxHeight: size(props.maxHeight) }))

defineExpose<ScrollbarExpose>({
  get wrap() {
    return wrapRef.value
  },
  scrollTo: (options) => wrapRef.value?.scrollTo(options),
  update,
})
</script>

<template>
  <div
    :class="[
      ns.b(),
      ns.is('always', always),
      ns.is('scrolling', scrolling),
      ns.is('dragging', !!dragging),
      ns.is('fixed', height !== undefined),
    ]"
    :style="rootStyle"
  >
    <div
      ref="wrap"
      :class="ns.e('wrap')"
      :style="wrapStyle"
      :tabindex="y.active || x.active ? 0 : undefined"
      @scroll="onScroll"
    >
      <div ref="view" :class="ns.e('view')"><slot /></div>
    </div>
    <div
      ref="barY"
      :class="[ns.e('bar'), ns.is('vertical', true), ns.is('active', y.active)]"
      aria-hidden="true"
      @pointerdown="onTrackDown($event, 'y')"
    >
      <div
        :class="ns.e('thumb')"
        :style="{ height: `${y.size}px`, transform: `translateY(${y.offset}px)` }"
        @pointerdown="onThumbDown($event, 'y')"
        @pointermove="onThumbMove"
        @pointerup="onThumbUp"
        @pointercancel="onThumbUp"
      />
    </div>
    <div
      ref="barX"
      :class="[ns.e('bar'), ns.is('horizontal', true), ns.is('active', x.active)]"
      aria-hidden="true"
      @pointerdown="onTrackDown($event, 'x')"
    >
      <div
        :class="ns.e('thumb')"
        :style="{ width: `${x.size}px`, transform: `translateX(${x.offset}px)` }"
        @pointerdown="onThumbDown($event, 'x')"
        @pointermove="onThumbMove"
        @pointerup="onThumbUp"
        @pointercancel="onThumbUp"
      />
    </div>
  </div>
</template>
