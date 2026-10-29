<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { useFloating } from '../../composables/use-floating'
import type { VirtualElement } from '../../composables/use-floating'
import { useLayer } from '../../composables/use-layer'
import { useThemeScope } from '../../composables/use-theme-scope'
import { useNamespace } from '../../utils/namespace'
import { useTeleport } from '../../utils/teleport'
import DouButton from '../button/button.vue'
import { useLocale, useZIndex } from '../config-provider/use-config'
import type { TourEmits, TourExpose, TourProps, TourSlots, TourTarget } from './tour'

defineOptions({ name: 'DouTour', inheritAttrs: false })

const props = withDefaults(defineProps<TourProps>(), {
  open: undefined,
  current: undefined,
  mask: true,
  closeOnMask: false,
  closeOnEscape: true,
  placement: 'bottom',
  padding: 6,
  showProgress: true,
  teleport: undefined,
})
const emit = defineEmits<TourEmits>()
defineSlots<TourSlots>()

const ns = useNamespace('tour')
const { t } = useLocale()
const id = `dou-tour-${useId()}`
const teleportTarget = useTeleport(() => props.teleport)

const innerOpen = ref(false)
const isOpen = computed(() => props.open ?? innerOpen.value)
const innerCurrent = ref(0)
const index = computed(() => {
  const value = props.current ?? innerCurrent.value
  return Math.min(Math.max(0, value), Math.max(0, props.steps.length - 1))
})
const step = computed(() => props.steps[index.value])
const total = computed(() => props.steps.length)
const isLast = computed(() => index.value >= total.value - 1)
const showMask = computed(() => step.value?.mask ?? props.mask)

function setOpen(value: boolean) {
  innerOpen.value = value
  emit('update:open', value)
}
function goTo(value: number) {
  if (value < 0 || value >= total.value || value === index.value) return
  innerCurrent.value = value
  emit('update:current', value)
  emit('change', value)
}
const prev = () => goTo(index.value - 1)
function next() {
  if (isLast.value) {
    setOpen(false)
    emit('finish')
  } else goTo(index.value + 1)
}
function close() {
  setOpen(false)
  emit('close')
}

/* ---------------- the target and the hole around it ---------------- */

function resolve(target: TourTarget | undefined): HTMLElement | null {
  if (!target || typeof document === 'undefined') return null
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target)
  if (typeof target === 'function') return target() ?? null
  return target
}

const target = ref<HTMLElement | null>(null)
const hole = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const viewport = ref({ width: 0, height: 0 })

function measure() {
  viewport.value = {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }
  const element = target.value
  if (!element || !element.isConnected) {
    hole.value = null
    return
  }
  const box = element.getBoundingClientRect()
  const pad = props.padding
  hole.value = {
    x: box.left - pad,
    y: box.top - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  }
}

let frame = 0
function schedule() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    measure()
    floating.update()
  })
}
function listen(on: boolean) {
  const method = on ? 'addEventListener' : 'removeEventListener'
  window[method]('scroll', schedule, { capture: true, passive: true } as AddEventListenerOptions)
  window[method]('resize', schedule, { passive: true } as AddEventListenerOptions)
}

const reference: VirtualElement = {
  getBoundingClientRect: () => {
    const box = hole.value
    if (box) return new DOMRect(box.x, box.y, box.width, box.height)
    // no target: the card sits in the middle of the screen
    const { width, height } = viewport.value
    return new DOMRect(width / 2, height / 2, 0, 0)
  },
}

const card = useTemplateRef<HTMLElement>('card')
const floating = useFloating(() => reference, card, {
  open: () => isOpen.value && !!hole.value,
  placement: () => step.value?.placement ?? props.placement,
  offset: 12,
})

const zIndex = ref<number>()
const { next: nextZIndex } = useZIndex()
const instance = getCurrentInstance()
const { theme, sync } = useThemeScope(() => instance?.vnode.el as Node | null)
const rendered = ref(false)

let returnTo: HTMLElement | null = null

async function show() {
  target.value = resolve(step.value?.target)
  target.value?.scrollIntoView?.({ block: 'center', inline: 'nearest' })
  measure()
  await nextTick()
  floating.update()
  card.value?.focus({ preventScroll: true })
}

watch(
  isOpen,
  (value) => {
    if (typeof document === 'undefined') return
    if (value) {
      returnTo = document.activeElement as HTMLElement | null
      rendered.value = true
      zIndex.value = nextZIndex()
      sync()
      listen(true)
      void show()
    } else {
      listen(false)
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true })
      returnTo = null
    }
  },
  { immediate: true },
)
watch(index, () => {
  if (isOpen.value) void show()
})
onBeforeUnmount(() => {
  listen(false)
  if (frame) cancelAnimationFrame(frame)
})

useLayer({
  open: isOpen,
  elements: () => [card.value, target.value],
  onEscape: () => {
    if (props.closeOnEscape) close()
  },
})

function onMaskClick() {
  if (props.closeOnMask) close()
}

function onCardKeydown(event: KeyboardEvent) {
  if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
  if (event.key === 'ArrowRight') next()
  else if (event.key === 'ArrowLeft') prev()
  else return
  event.preventDefault()
}

/** The dimmed area: the whole screen with a rounded hole over the target. */
const maskPath = computed(() => {
  const { width, height } = viewport.value
  let path = `M0 0H${width}V${height}H0Z`
  const box = hole.value
  if (box) {
    const r = Math.min(8, box.width / 2, box.height / 2)
    const { x, y, width: w, height: h } = box
    path +=
      `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
      `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
      `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
      `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  }
  return path
})

const cardStyle = computed(() =>
  hole.value
    ? { ...floating.style.value, zIndex: zIndex.value }
    : {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        translate: '-50% -50%',
        zIndex: zIndex.value,
      },
)

const slotProps = computed(() => ({ step: step.value!, current: index.value, total: total.value }))
const titleId = `${id}-title`
const bodyId = `${id}-body`

defineExpose<TourExpose>({ next, prev, close })
</script>

<template>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <div v-if="isOpen && step" :class="ns.b()" :data-dou-theme="theme">
      <svg
        v-if="showMask"
        :class="ns.e('mask')"
        :style="{ zIndex }"
        :viewBox="`0 0 ${viewport.width} ${viewport.height}`"
        aria-hidden="true"
      >
        <path :d="maskPath" fill-rule="evenodd" @click="onMaskClick" />
      </svg>
      <div
        v-if="hole"
        :class="ns.e('ring')"
        :style="{
          zIndex,
          top: `${hole.y}px`,
          left: `${hole.x}px`,
          width: `${hole.width}px`,
          height: `${hole.height}px`,
        }"
        aria-hidden="true"
      />
      <Transition appear name="dou-floating">
        <div
          v-bind="$attrs"
          ref="card"
          role="dialog"
          :aria-labelledby="step.title || $slots.title ? titleId : undefined"
          :aria-label="step.title || $slots.title ? undefined : t('tour.label')"
          :aria-describedby="bodyId"
          tabindex="-1"
          :class="[ns.e('card'), 'dou-floating']"
          :style="cardStyle"
          :data-placement="hole ? floating.placement.value : undefined"
          @keydown="onCardKeydown"
        >
          <div :class="ns.e('header')">
            <div :id="titleId" :class="ns.e('title')">
              <slot name="title" v-bind="slotProps">{{ step.title }}</slot>
            </div>
            <button
              type="button"
              :class="ns.e('close')"
              :aria-label="t('tour.close')"
              @click="close"
            >
              <CloseIcon />
            </button>
          </div>
          <div :id="bodyId" :class="ns.e('body')">
            <slot v-bind="slotProps">{{ step.description }}</slot>
          </div>
          <div :class="ns.e('footer')">
            <span v-if="showProgress && total > 1" :class="ns.e('progress')">
              {{ t('tour.progress', { current: index + 1, total }) }}
            </span>
            <div :class="ns.e('actions')">
              <slot name="actions" v-bind="slotProps" :prev="prev" :next="next" :close="close">
                <DouButton v-if="index > 0" size="sm" variant="outline" @click="prev">
                  {{ t('tour.prev') }}
                </DouButton>
                <DouButton size="sm" tone="primary" @click="next">
                  {{ isLast ? t('tour.finish') : t('tour.next') }}
                </DouButton>
              </slot>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
