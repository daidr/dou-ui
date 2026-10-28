<script setup lang="ts">
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  MaximizeIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@dou-ui/icons'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { useModal } from '../../composables/use-modal'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { ImagePreviewProps } from './image'
import { clampScale, normalizePreview, stepScale } from './preview'

defineOptions({ name: 'DouImagePreview', inheritAttrs: false })

const props = withDefaults(defineProps<ImagePreviewProps>(), {
  images: () => [],
  loop: false,
  minScale: 0.25,
  maxScale: 4,
  closeOnMask: true,
  teleport: 'body',
})
const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })
const emit = defineEmits<{ close: [] }>()

const ns = useNamespace('image-preview')
const { t } = useLocale()
const id = `dou-image-preview-${useId()}`

const list = computed(() => normalizePreview(props.images))
const count = computed(() => list.value.length)
const current = computed(() => list.value[Math.min(index.value, count.value - 1)])

/* the view */

const scale = ref(1)
const rotate = ref(0)
const offset = ref({ x: 0, y: 0 })
const failed = ref(false)

function reset() {
  scale.value = 1
  rotate.value = 0
  offset.value = { x: 0, y: 0 }
}
watch([index, open], () => {
  reset()
  failed.value = false
})

function zoom(direction: 1 | -1) {
  scale.value = clampScale(stepScale(scale.value, direction), props.minScale, props.maxScale)
  if (scale.value <= 1) offset.value = { x: 0, y: 0 }
}
const turn = (by: number) => (rotate.value += by)

const canPrev = computed(() => count.value > 1 && (props.loop || index.value > 0))
const canNext = computed(() => count.value > 1 && (props.loop || index.value < count.value - 1))
function go(step: 1 | -1) {
  if (step < 0 ? !canPrev.value : !canNext.value) return
  index.value = (index.value + step + count.value) % count.value
}

function close() {
  open.value = false
  emit('close')
}

const root = useTemplateRef<HTMLElement>('root')
const { rendered, zIndex, theme, maskListeners } = useModal({
  open,
  root,
  panel: root,
  closeOnEscape: true,
  closeOnMask: () => props.closeOnMask,
  lockScroll: true,
  requestClose: close,
})

/* input */

function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' '))
    return
  const actions: Record<string, () => void> = {
    ArrowLeft: () => go(-1),
    ArrowRight: () => go(1),
    '+': () => zoom(1),
    '=': () => zoom(1),
    '-': () => zoom(-1),
    '0': reset,
    r: () => turn(90),
    R: () => turn(-90),
  }
  const action = actions[event.key]
  if (!action) return
  event.preventDefault()
  action()
}

let wheelAt = 0
function onWheel(event: WheelEvent) {
  event.preventDefault()
  // Trackpads send a stream of tiny deltas; take one step per gesture tick.
  const now = event.timeStamp
  if (now - wheelAt < 40) return
  wheelAt = now
  zoom(event.deltaY < 0 ? 1 : -1)
}

let drag: { x: number; y: number; from: { x: number; y: number } } | undefined
function onPointerdown(event: PointerEvent) {
  if (event.button !== 0 || scale.value <= 1) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  drag = { x: event.clientX, y: event.clientY, from: offset.value }
}
function onPointermove(event: PointerEvent) {
  if (!drag) return
  offset.value = {
    x: drag.from.x + event.clientX - drag.x,
    y: drag.from.y + event.clientY - drag.y,
  }
}
function onPointerup() {
  drag = undefined
}
function onDblclick() {
  if (scale.value === 1) scale.value = clampScale(2, props.minScale, props.maxScale)
  else reset()
}

const transform = computed(
  () =>
    `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value}) rotate(${rotate.value}deg)`,
)
const label = computed(() =>
  count.value > 1
    ? t('image.counter', { index: Math.min(index.value, count.value - 1) + 1, total: count.value })
    : '',
)
</script>

<template>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition name="dou-image-preview">
      <div
        v-show="open"
        :id="id"
        ref="root"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-label="current?.alt || t('image.preview')"
        v-bind="$attrs"
        :class="ns.b()"
        :style="{ zIndex }"
        :data-dou-theme="theme"
        @keydown="onKeydown"
      >
        <div :class="ns.e('stage')" v-bind="maskListeners" @wheel="onWheel">
          <img
            v-if="current && !failed"
            :key="current.src"
            :class="[ns.e('image'), ns.is('movable', scale > 1)]"
            :src="current.src"
            :alt="current.alt ?? ''"
            :style="{ transform }"
            draggable="false"
            @error="failed = true"
            @pointerdown="onPointerdown"
            @pointermove="onPointermove"
            @pointerup="onPointerup"
            @pointercancel="onPointerup"
            @dblclick="onDblclick"
          />
          <div v-else-if="current" :class="ns.e('error')">{{ t('image.error') }}</div>
        </div>

        <button
          v-if="count > 1"
          type="button"
          :class="[ns.e('nav'), ns.is('prev', true)]"
          :disabled="!canPrev"
          :aria-label="t('image.prev')"
          @click="go(-1)"
        >
          <ChevronLeftIcon />
        </button>
        <button
          v-if="count > 1"
          type="button"
          :class="[ns.e('nav'), ns.is('next', true)]"
          :disabled="!canNext"
          :aria-label="t('image.next')"
          @click="go(1)"
        >
          <ChevronRightIcon />
        </button>

        <button type="button" :class="ns.e('close')" :aria-label="t('image.close')" @click="close">
          <CloseIcon />
        </button>

        <div :class="ns.e('toolbar')" role="toolbar" :aria-label="t('image.preview')">
          <span v-if="label" :class="ns.e('counter')" aria-live="polite">{{ label }}</span>
          <button
            type="button"
            :class="ns.e('tool')"
            :disabled="scale <= minScale"
            :aria-label="t('image.zoomOut')"
            @click="zoom(-1)"
          >
            <ZoomOutIcon />
          </button>
          <span :class="ns.e('scale')" aria-live="polite">{{ Math.round(scale * 100) }}%</span>
          <button
            type="button"
            :class="ns.e('tool')"
            :disabled="scale >= maxScale"
            :aria-label="t('image.zoomIn')"
            @click="zoom(1)"
          >
            <ZoomInIcon />
          </button>
          <span :class="ns.e('divider')" aria-hidden="true" />
          <button
            type="button"
            :class="ns.e('tool')"
            :aria-label="t('image.rotateLeft')"
            @click="turn(-90)"
          >
            <RotateCcwIcon />
          </button>
          <button
            type="button"
            :class="ns.e('tool')"
            :aria-label="t('image.rotateRight')"
            @click="turn(90)"
          >
            <RotateCwIcon />
          </button>
          <button type="button" :class="ns.e('tool')" :aria-label="t('image.reset')" @click="reset">
            <MaximizeIcon />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
