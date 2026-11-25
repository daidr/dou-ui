<script setup lang="ts">
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  MaximizeIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@dou-ui/icons'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { useModal } from '../../composables/use-modal'
import { useNamespace } from '../../utils/namespace'
import { useScopeAttrs } from '../../utils/scope-id'
import { useTeleport } from '../../utils/teleport'
import { useLocale } from '../config-provider/use-config'
import type { ImagePreviewProps } from './image'
import { downloadImage, normalizePreview } from './preview'
import { usePreviewViewport } from './use-preview-viewport'

defineOptions({ name: 'DouImagePreview', inheritAttrs: false })

const props = withDefaults(defineProps<ImagePreviewProps>(), {
  images: () => [],
  loop: false,
  minScale: 0.25,
  maxScale: 4,
  closeOnMask: true,
  teleport: undefined,
  downloadable: false,
})
const teleportTarget = useTeleport(() => props.teleport)
const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })
const emit = defineEmits<{ close: [] }>()

const ns = useNamespace('image-preview')
const scopeAttrs = useScopeAttrs()
const { t } = useLocale()
const id = `dou-image-preview-${useId()}`

const list = computed(() => normalizePreview(props.images))
const count = computed(() => list.value.length)
const current = computed(() => list.value[Math.min(index.value, count.value - 1)])

/* the view */

const failed = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const stage = useTemplateRef<HTMLElement>('stage')
const image = useTemplateRef<HTMLImageElement>('image')

const {
  scale,
  flip,
  interacting,
  dragging,
  canPan,
  transform,
  reset,
  zoom,
  turn,
  mirror,
  syncBounds,
  canCloseOnMask,
  consumeMaskClick,
  onPointerdown,
  onPointermove,
  onPointerup,
  onPointercancel,
  onDblclick,
  onWheel,
} = usePreviewViewport({
  stageRef: stage,
  imageRef: image,
  active: () => open.value && !!current.value && !failed.value,
  minScale: () => props.minScale,
  maxScale: () => props.maxScale,
})

watch([index, open], () => {
  reset()
  failed.value = false
  if (open.value) void nextTick(syncBounds)
})

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

const { rendered, zIndex, theme, maskListeners } = useModal({
  open,
  root,
  panel: root,
  closeOnEscape: true,
  closeOnMask: () => props.closeOnMask && canCloseOnMask(),
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
    h: () => mirror('x'),
    v: () => mirror('y'),
  }
  const action = actions[event.key]
  if (!action) return
  event.preventDefault()
  action()
}

function onStagePointerdown(event: PointerEvent) {
  maskListeners.onPointerdown(event)
  onPointerdown(event)
}

function onStageClick(event: MouseEvent) {
  if (consumeMaskClick()) {
    maskListeners.onClick(event)
  }
}

const label = computed(() =>
  count.value > 1
    ? t('image.counter', { index: Math.min(index.value, count.value - 1) + 1, total: count.value })
    : '',
)
</script>

<template>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-image-preview">
      <div
        v-show="open"
        :id="id"
        ref="root"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-label="current?.alt || t('image.preview')"
        v-bind="{ ...scopeAttrs(), ...$attrs }"
        :class="ns.b()"
        :style="{ zIndex }"
        :data-dou-theme="theme"
        @keydown="onKeydown"
      >
        <div
          ref="stage"
          :class="[ns.e('stage'), ns.is('movable', canPan), ns.is('dragging', dragging)]"
          @pointerdown="onStagePointerdown"
          @pointermove="onPointermove"
          @pointerup="onPointerup"
          @pointercancel="onPointercancel"
          @click="onStageClick"
          @wheel="onWheel"
        >
          <img
            v-if="current && !failed"
            ref="image"
            :key="current.src"
            :class="[
              ns.e('image'),
              ns.is('movable', canPan),
              ns.is('dragging', dragging),
              ns.is('interacting', interacting),
            ]"
            :src="current.src"
            :alt="current.alt ?? ''"
            :style="{ transform }"
            draggable="false"
            @load="syncBounds"
            @error="failed = true"
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
          <button
            type="button"
            :class="ns.e('tool')"
            :aria-label="t('image.flipHorizontal')"
            :aria-pressed="flip.x < 0"
            @click="mirror('x')"
          >
            <FlipHorizontalIcon />
          </button>
          <button
            type="button"
            :class="ns.e('tool')"
            :aria-label="t('image.flipVertical')"
            :aria-pressed="flip.y < 0"
            @click="mirror('y')"
          >
            <FlipVerticalIcon />
          </button>
          <button type="button" :class="ns.e('tool')" :aria-label="t('image.reset')" @click="reset">
            <MaximizeIcon />
          </button>
          <template v-if="downloadable && current">
            <span :class="ns.e('divider')" aria-hidden="true" />
            <button
              type="button"
              :class="ns.e('tool')"
              :aria-label="t('image.download')"
              @click="downloadImage(current.src)"
            >
              <DownloadIcon />
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
