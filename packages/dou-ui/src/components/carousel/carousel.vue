<script setup lang="ts">
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  PauseIcon,
  PlayIcon,
} from '@dou-ui/icons'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  toRef,
  triggerRef,
  useId,
  watch,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { carouselKey } from './carousel'
import type {
  CarouselEmits,
  CarouselExpose,
  CarouselItemEntry,
  CarouselProps,
  CarouselSlots,
} from './carousel'

defineOptions({ name: 'DouCarousel' })

const props = withDefaults(defineProps<CarouselProps>(), {
  modelValue: undefined,
  direction: 'horizontal',
  effect: 'slide',
  loop: true,
  autoplay: false,
  interval: 4000,
  indicators: 'inside',
  arrows: 'hover',
  draggable: true,
})
const emit = defineEmits<CarouselEmits>()
defineSlots<CarouselSlots>()

const ns = useNamespace('carousel')
const { t } = useLocale()
const id = `dou-carousel-${useId()}`

/* ---------------- slides ---------------- */

const items = shallowRef<CarouselItemEntry[]>([])
function register(entry: CarouselItemEntry) {
  items.value = [...items.value, entry]
}
function unregister(uid: number) {
  items.value = items.value.filter((entry) => entry.uid !== uid)
}
function reorder() {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  const sorted = [...items.value].sort((a, b) => {
    if (!a.el.value || !b.el.value) return 0
    return a.el.value.compareDocumentPosition(b.el.value) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1
  })
  if (sorted.some((entry, index) => entry !== items.value[index])) items.value = sorted
  else triggerRef(items)
}
const total = computed(() => items.value.length)

const inner = ref(props.modelValue ?? 0)
const current = computed(() => {
  const value = props.modelValue ?? inner.value
  return total.value ? Math.min(Math.max(0, value), total.value - 1) : 0
})
// the slide shown before the last change, to tell which slides move into view
const previous = ref(current.value)
watch(current, (_, old) => (previous.value = old), { flush: 'sync' })

const looping = computed(() => props.loop && total.value > 2)

function offsetOf(index: number, from: number) {
  let offset = index - from
  if (looping.value) {
    const half = total.value / 2
    if (offset > half) offset -= total.value
    else if (offset < -half) offset += total.value
  }
  return offset
}

function place(uid: number) {
  const index = items.value.findIndex((entry) => entry.uid === uid)
  const offset = offsetOf(index, current.value)
  // a slide that jumps across the track (wrapping around) moves without a transition
  const animate = Math.abs(offset - offsetOf(index, previous.value)) <= 1
  return { index, offset, animate }
}

function goTo(index: number) {
  if (!total.value) return
  let target = index
  if (props.loop) target = ((index % total.value) + total.value) % total.value
  else target = Math.min(Math.max(0, index), total.value - 1)
  if (target === current.value) return
  const from = current.value
  inner.value = target
  emit('update:modelValue', target)
  emit('change', target, from)
}
const next = () => goTo(current.value + 1)
const prev = () => goTo(current.value - 1)
const canPrev = computed(() => props.loop || current.value > 0)
const canNext = computed(() => props.loop || current.value < total.value - 1)

/* ---------------- dragging ---------------- */

const drag = ref(0)
const viewport = ref<HTMLElement | null>(null)
const vertical = computed(() => props.direction === 'vertical')
let start: { pointer: number; at: number; time: number } | undefined
let moved = false

function onPointerdown(event: PointerEvent) {
  if (!props.draggable || total.value < 2 || event.button !== 0) return
  if ((event.target as Element).closest('button, a, input, textarea, select, [contenteditable]'))
    return
  start = {
    pointer: event.pointerId,
    at: vertical.value ? event.clientY : event.clientX,
    time: event.timeStamp,
  }
  moved = false
}
function onPointermove(event: PointerEvent) {
  if (!start || event.pointerId !== start.pointer) return
  let delta = (vertical.value ? event.clientY : event.clientX) - start.at
  if (!moved && Math.abs(delta) < 6) return
  if (!moved) {
    moved = true
    viewport.value?.setPointerCapture?.(event.pointerId)
  }
  // resist past the ends
  if ((delta > 0 && !canPrev.value) || (delta < 0 && !canNext.value)) delta /= 3
  drag.value = props.effect === 'fade' ? 0 : delta
  if (props.effect === 'fade') fadeDelta = delta
}
let fadeDelta = 0
function onPointerup(event: PointerEvent) {
  if (!start || event.pointerId !== start.pointer) return
  const delta = props.effect === 'fade' ? fadeDelta : drag.value
  const size = (vertical.value ? viewport.value?.clientHeight : viewport.value?.clientWidth) || 1
  const speed = Math.abs(delta) / Math.max(1, event.timeStamp - start.time)
  start = undefined
  drag.value = 0
  fadeDelta = 0
  if (!moved) return
  if (Math.abs(delta) > size * 0.2 || speed > 0.4) {
    if (delta < 0) next()
    else prev()
  }
}
// a drag that ends over a link or button inside a slide is not a click
function onClickCapture(event: MouseEvent) {
  if (!moved) return
  moved = false
  event.preventDefault()
  event.stopPropagation()
}

/* ---------------- autoplay ---------------- */

const hovered = ref(false)
const focused = ref(false)
const stopped = ref(false)
const hidden = ref(false)
const reduced = ref(false)
const playing = computed(
  () =>
    props.autoplay &&
    total.value > 1 &&
    !stopped.value &&
    !reduced.value &&
    !hovered.value &&
    !focused.value &&
    !hidden.value &&
    !drag.value,
)

let timer: ReturnType<typeof setTimeout> | undefined
watch(
  [playing, current, () => props.interval],
  () => {
    clearTimeout(timer)
    if (!playing.value) return
    timer = setTimeout(() => {
      if (!props.loop && current.value >= total.value - 1) goTo(0)
      else next()
    }, props.interval)
  },
  { flush: 'post' },
)

let motion: MediaQueryList | undefined
const onMotion = () => (reduced.value = !!motion?.matches)
const onVisibility = () => (hidden.value = document.visibilityState === 'hidden')
onMounted(() => {
  motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  onMotion()
  motion?.addEventListener?.('change', onMotion)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  motion?.removeEventListener?.('change', onMotion)
  document.removeEventListener('visibilitychange', onVisibility)
})

function onFocusout(event: FocusEvent) {
  const root = event.currentTarget as HTMLElement
  if (!root.contains(event.relatedTarget as Node | null)) focused.value = false
}

/* ---------------- keyboard ---------------- */

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable]')) return
  const back = vertical.value ? 'ArrowUp' : 'ArrowLeft'
  const forward = vertical.value ? 'ArrowDown' : 'ArrowRight'
  if (event.key === back) prev()
  else if (event.key === forward) next()
  else return
  event.preventDefault()
}

provide(carouselKey, {
  register,
  unregister,
  reorder,
  place,
  total,
  current,
  direction: toRef(() => props.direction),
  effect: toRef(() => props.effect),
  drag,
})

defineExpose<CarouselExpose>({ goTo, next, prev })

const PrevIcon = () => (vertical.value ? ChevronUpIcon : ChevronLeftIcon)
const NextIcon = () => (vertical.value ? ChevronDownIcon : ChevronRightIcon)
</script>

<template>
  <section
    :class="[
      ns.b(),
      ns.m(direction),
      ns.m(effect),
      ns.m(`arrows-${arrows}`),
      ns.m(`indicators-${indicators}`),
      ns.is('fixed', !!height),
      ns.is('dragging', !!drag),
    ]"
    aria-roledescription="carousel"
    :aria-label="label ?? t('carousel.label')"
    @keydown="onKeydown"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
    @focusin="focused = true"
    @focusout="onFocusout"
  >
    <div :class="ns.e('stage')">
      <div
        :id="`${id}-slides`"
        ref="viewport"
        :class="ns.e('viewport')"
        :style="{ height }"
        :aria-live="playing ? 'off' : 'polite'"
        @pointerdown="onPointerdown"
        @pointermove="onPointermove"
        @pointerup="onPointerup"
        @pointercancel="onPointerup"
        @click.capture="onClickCapture"
        @dragstart.prevent
      >
        <slot />
      </div>

      <template v-if="arrows !== 'never' && total > 1">
        <button
          type="button"
          :class="[ns.e('arrow'), `${ns.e('arrow')}--prev`]"
          :aria-label="t('carousel.prev')"
          :aria-controls="`${id}-slides`"
          :disabled="!canPrev"
          @click="prev"
        >
          <component :is="PrevIcon()" />
        </button>
        <button
          type="button"
          :class="[ns.e('arrow'), `${ns.e('arrow')}--next`]"
          :aria-label="t('carousel.next')"
          :aria-controls="`${id}-slides`"
          :disabled="!canNext"
          @click="next"
        >
          <component :is="NextIcon()" />
        </button>
      </template>
    </div>
    <div v-if="(indicators !== 'none' && total > 1) || autoplay" :class="ns.e('controls')">
      <button
        v-if="autoplay && total > 1"
        type="button"
        :class="ns.e('play')"
        :aria-label="stopped ? t('carousel.play') : t('carousel.pause')"
        @click="stopped = !stopped"
      >
        <PlayIcon v-if="stopped" />
        <PauseIcon v-else />
      </button>
      <div v-if="indicators !== 'none' && total > 1" :class="ns.e('indicators')">
        <button
          v-for="(entry, index) in items"
          :key="entry.uid"
          type="button"
          :class="[ns.e('indicator'), ns.is('active', index === current)]"
          :aria-label="t('carousel.goTo', { index: index + 1 })"
          :aria-current="index === current ? 'true' : undefined"
          :aria-controls="`${id}-slides`"
          @click="goTo(index)"
        />
      </div>
    </div>
  </section>
</template>
