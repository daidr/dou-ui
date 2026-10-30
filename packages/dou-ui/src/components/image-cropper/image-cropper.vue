<script setup lang="ts">
import { RefreshIcon, RotateCcwIcon, RotateCwIcon, ZoomInIcon, ZoomOutIcon } from '@dou-ui/icons'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import DouButton from '../button/button.vue'
import { useLocale } from '../config-provider/use-config'
import DouSlider from '../slider/slider.vue'
import DouSpinner from '../spinner/spinner.vue'
import type {
  ImageCropperArea,
  ImageCropperBlobOptions,
  ImageCropperExpose,
  ImageCropperOutputOptions,
  ImageCropperProps,
} from './image-cropper'

defineOptions({ name: 'DouImageCropper' })

const props = withDefaults(defineProps<ImageCropperProps>(), {
  aspectRatio: 1,
  shape: 'rect',
  height: 320,
  maxZoom: 4,
  toolbar: true,
  disabled: false,
})
const emit = defineEmits<{
  ready: [size: { width: number; height: number }]
  error: [event: Event]
  change: [area: ImageCropperArea]
}>()

const ns = useNamespace('image-cropper')
const { t } = useLocale()
const stageRef = useTemplateRef<HTMLElement>('stage')
const imageRef = useTemplateRef<HTMLImageElement>('image')

/* the source */

const url = ref<string>()
let objectUrl: string | undefined
function revoke() {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = undefined
}
watch(
  () => props.src,
  (src) => {
    revoke()
    status.value = src ? 'loading' : 'empty'
    if (src instanceof Blob) {
      // Object URLs only exist in the browser.
      if (typeof URL.createObjectURL !== 'function') return
      url.value = objectUrl = URL.createObjectURL(src)
    } else url.value = src ?? undefined
  },
)
onBeforeUnmount(revoke)

const status = ref<'empty' | 'loading' | 'ready' | 'error'>(props.src ? 'loading' : 'empty')
const natural = ref({ width: 0, height: 0 })
onMounted(() => {
  // A string `src` is rendered on the server already; a blob is turned into a URL now.
  const src = props.src
  if (src instanceof Blob) url.value = objectUrl = URL.createObjectURL(src)
  else url.value = src ?? undefined
  const img = imageRef.value
  if (img?.complete && img.naturalWidth) onLoad()
})

function onLoad() {
  const img = imageRef.value
  if (!img) return
  natural.value = { width: img.naturalWidth, height: img.naturalHeight }
  status.value = 'ready'
  reset(false)
  emit('ready', { ...natural.value })
  emitChange()
}
function onError(event: Event) {
  if (!url.value) return
  status.value = 'error'
  emit('error', event)
}

/* the stage and the frame */

const stage = ref({ width: 0, height: 0 })
let observer: ResizeObserver | undefined
onMounted(() => {
  const el = stageRef.value
  if (!el) return
  const measure = () => {
    const previous = frame.value.width
    stage.value = { width: el.clientWidth, height: el.clientHeight }
    // Keep the same part of the image in the frame when the area resizes.
    if (previous && frame.value.width) {
      const ratio = frame.value.width / previous
      offset.value = { x: offset.value.x * ratio, y: offset.value.y * ratio }
    }
  }
  measure()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

const PADDING = 24
/** The crop frame, centered on the stage, as large as fits with some room around it. */
const frame = computed(() => {
  const ratio = props.aspectRatio > 0 ? props.aspectRatio : 1
  const maxWidth = Math.max(stage.value.width - PADDING * 2, 0)
  const maxHeight = Math.max(stage.value.height - PADDING * 2, 0)
  const width = Math.min(maxWidth, maxHeight * ratio)
  return { width, height: width / ratio }
})

/* the image's position */

const rotation = ref(0)
/** 1 just fills the frame; `maxZoom` is as far as it goes. */
const zoom = ref(1)
/** The image center's offset from the frame center, in px on screen. */
const offset = ref({ x: 0, y: 0 })

/** The image's size once rotated: a quarter turn swaps its sides. */
const turned = computed(() =>
  rotation.value % 180
    ? { width: natural.value.height, height: natural.value.width }
    : { ...natural.value },
)
const baseScale = computed(() => {
  const { width, height } = turned.value
  if (!width || !height) return 1
  return Math.max(frame.value.width / width, frame.value.height / height)
})
const scale = computed(() => baseScale.value * zoom.value)

/** Keep the image covering the frame. */
function clampOffset(next: { x: number; y: number }, s = scale.value) {
  const maxX = Math.max((turned.value.width * s - frame.value.width) / 2, 0)
  const maxY = Math.max((turned.value.height * s - frame.value.height) / 2, 0)
  return {
    x: Math.min(Math.max(next.x, -maxX), maxX),
    y: Math.min(Math.max(next.y, -maxY), maxY),
  }
}
watch([frame, turned], () => (offset.value = clampOffset(offset.value)))

const imageStyle = computed(() => ({
  width: `${natural.value.width}px`,
  height: `${natural.value.height}px`,
  transform: `translate(calc(-50% + ${offset.value.x}px), calc(-50% + ${offset.value.y}px)) rotate(${rotation.value}deg) scale(${scale.value})`,
}))
const frameStyle = computed(() => ({
  width: `${frame.value.width}px`,
  height: `${frame.value.height}px`,
}))

/** Zoom to `next`, keeping the point `at` (relative to the frame center) still. */
function zoomAround(next: number, at = { x: 0, y: 0 }) {
  const value = Math.min(Math.max(next, 1), Math.max(props.maxZoom, 1))
  const ratio = value / zoom.value
  zoom.value = value
  offset.value = clampOffset({
    x: at.x - (at.x - offset.value.x) * ratio,
    y: at.y - (at.y - offset.value.y) * ratio,
  })
}

const round = (value: number) => Math.round(value * 100) / 100

function getArea(): ImageCropperArea | null {
  if (status.value !== 'ready') return null
  const s = scale.value
  const { width, height } = turned.value
  return {
    x: round((width * s - frame.value.width) / 2 / s - offset.value.x / s),
    y: round((height * s - frame.value.height) / 2 / s - offset.value.y / s),
    width: round(frame.value.width / s),
    height: round(frame.value.height / s),
    rotate: rotation.value,
  }
}
function emitChange() {
  const area = getArea()
  if (area) emit('change', area)
}

function rotate(degrees: number) {
  const quarter = Math.round(degrees / 90) * 90
  if (!quarter) return
  rotation.value = (((rotation.value + quarter) % 360) + 360) % 360
  // Turn the offset with the image, so the same spot stays in the frame.
  const { x, y } = offset.value
  const turns = (((quarter / 90) % 4) + 4) % 4
  const turnedOffset = [
    { x, y },
    { x: -y, y: x },
    { x: -x, y: -y },
    { x: y, y: -x },
  ][turns]!
  offset.value = clampOffset(turnedOffset)
  emitChange()
}

function reset(notify = true) {
  rotation.value = 0
  zoom.value = 1
  offset.value = { x: 0, y: 0 }
  if (notify) emitChange()
}

/* pointer: drag to move, wheel or pinch to zoom */

const interactive = computed(() => status.value === 'ready' && !props.disabled)
const moving = ref(false)
const pointers = new Map<number, { x: number; y: number }>()

/** A point relative to the frame center, which is the stage center. */
function local(x: number, y: number) {
  const rect = stageRef.value!.getBoundingClientRect()
  return { x: x - rect.left - rect.width / 2, y: y - rect.top - rect.height / 2 }
}

function onPointerDown(event: PointerEvent) {
  if (!interactive.value || (event.pointerType === 'mouse' && event.button !== 0)) return
  const el = event.currentTarget as HTMLElement
  el.setPointerCapture?.(event.pointerId)
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  moving.value = true
}
function onPointerMove(event: PointerEvent) {
  const last = pointers.get(event.pointerId)
  if (!last) return
  const point = { x: event.clientX, y: event.clientY }
  if (pointers.size === 2) {
    // Pinch: zoom by how much the two fingers spread, around their midpoint.
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1]
    const before = Math.hypot(last.x - other.x, last.y - other.y)
    const after = Math.hypot(point.x - other.x, point.y - other.y)
    if (before > 0) {
      zoomAround(
        zoom.value * (after / before),
        local((point.x + other.x) / 2, (point.y + other.y) / 2),
      )
    }
  } else {
    offset.value = clampOffset({
      x: offset.value.x + point.x - last.x,
      y: offset.value.y + point.y - last.y,
    })
  }
  pointers.set(event.pointerId, point)
}
function onPointerUp(event: PointerEvent) {
  if (!pointers.delete(event.pointerId)) return
  if (!pointers.size) {
    moving.value = false
    emitChange()
  }
}

let wheelTimer: ReturnType<typeof setTimeout> | undefined
function onWheel(event: WheelEvent) {
  if (!interactive.value) return
  event.preventDefault()
  // Pixel deltas from trackpads are small and many; line deltas from wheels are large.
  const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
  zoomAround(zoom.value * Math.exp(-delta / 400), local(event.clientX, event.clientY))
  clearTimeout(wheelTimer)
  wheelTimer = setTimeout(emitChange, 200)
}
onBeforeUnmount(() => clearTimeout(wheelTimer))

/* keyboard */

function onKeydown(event: KeyboardEvent) {
  if (!interactive.value) return
  const step = event.shiftKey ? 40 : 8
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const by = moves[event.key]
  if (by) {
    // The arrows move the image, as dragging does.
    offset.value = clampOffset({ x: offset.value.x + by[0], y: offset.value.y + by[1] })
  } else if (event.key === '+' || event.key === '=') zoomAround(zoom.value * 1.1)
  else if (event.key === '-' || event.key === '_') zoomAround(zoom.value / 1.1)
  else return
  event.preventDefault()
  emitChange()
}

/* the toolbar */

const ZOOM_STEP = 1.25
function onSlider(value: number | [number, number] | undefined) {
  if (typeof value === 'number') zoomAround(value)
}

/* output */

function getCanvas(options: ImageCropperOutputOptions = {}): HTMLCanvasElement | null {
  const img = imageRef.value
  const area = getArea()
  if (!img || !area) return null
  const ratio = frame.value.width / frame.value.height
  let width = options.width ?? Math.round(area.width)
  if (options.width === undefined && options.maxWidth) width = Math.min(width, options.maxWidth)
  width = Math.max(1, Math.round(width))
  const height = Math.max(1, Math.round(width / ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (options.background) {
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingQuality = 'high'
  // Draw the image the way the stage shows it, scaled from the frame to the canvas.
  const k = width / frame.value.width
  ctx.scale(k, k)
  ctx.translate(frame.value.width / 2 + offset.value.x, frame.value.height / 2 + offset.value.y)
  ctx.rotate((rotation.value * Math.PI) / 180)
  ctx.scale(scale.value, scale.value)
  ctx.drawImage(img, -natural.value.width / 2, -natural.value.height / 2)
  return canvas
}

function getBlob(options: ImageCropperBlobOptions = {}): Promise<Blob | null> {
  const canvas = getCanvas(options)
  if (!canvas) return Promise.resolve(null)
  return new Promise((resolve) =>
    canvas.toBlob(resolve, options.type ?? 'image/png', options.quality),
  )
}

defineExpose<ImageCropperExpose>({
  getCanvas,
  getBlob,
  getArea,
  rotate,
  zoomTo: (value) => {
    zoomAround(value)
    emitChange()
  },
  reset: () => reset(),
})

const stageStyle = computed(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
}))
const percent = computed(() => Math.round(zoom.value * 100))
</script>

<template>
  <div :class="[ns.b(), ns.is('disabled', disabled)]">
    <div
      ref="stage"
      :class="[ns.e('stage'), ns.is('moving', moving), ns.is('ready', status === 'ready')]"
      :style="stageStyle"
      role="group"
      :tabindex="interactive ? 0 : undefined"
      :aria-label="t('imageCropper.label')"
      :aria-description="interactive ? t('imageCropper.hint') : undefined"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
      @keydown="onKeydown"
    >
      <img
        v-if="url"
        v-show="status === 'ready'"
        ref="image"
        :class="ns.e('image')"
        :src="url"
        :style="imageStyle"
        :crossorigin="crossOrigin"
        alt=""
        draggable="false"
        @load="onLoad"
        @error="onError"
      />
      <div
        v-if="status === 'ready'"
        :class="[ns.e('frame'), ns.is('round', shape === 'round')]"
        :style="frameStyle"
        aria-hidden="true"
      />
      <div v-if="status === 'loading'" :class="ns.e('placeholder')">
        <DouSpinner />
      </div>
      <div v-else-if="status === 'error'" :class="ns.e('placeholder')" role="alert">
        {{ t('imageCropper.error') }}
      </div>
    </div>
    <div v-if="toolbar" :class="ns.e('toolbar')">
      <DouButton
        variant="ghost"
        size="sm"
        :disabled="!interactive || zoom <= 1"
        :aria-label="t('imageCropper.zoomOut')"
        @click="(zoomAround(zoom / ZOOM_STEP), emitChange())"
      >
        <ZoomOutIcon />
      </DouButton>
      <DouSlider
        :class="ns.e('zoom')"
        size="sm"
        :model-value="zoom"
        :min="1"
        :max="Math.max(maxZoom, 1)"
        :step="0.01"
        :disabled="!interactive"
        :format="() => `${percent}%`"
        :aria-label="t('imageCropper.zoom')"
        @update:model-value="onSlider"
        @change="emitChange"
      />
      <DouButton
        variant="ghost"
        size="sm"
        :disabled="!interactive || zoom >= maxZoom"
        :aria-label="t('imageCropper.zoomIn')"
        @click="(zoomAround(zoom * ZOOM_STEP), emitChange())"
      >
        <ZoomInIcon />
      </DouButton>
      <span :class="ns.e('divider')" aria-hidden="true" />
      <DouButton
        variant="ghost"
        size="sm"
        :disabled="!interactive"
        :aria-label="t('imageCropper.rotateLeft')"
        @click="rotate(-90)"
      >
        <RotateCcwIcon />
      </DouButton>
      <DouButton
        variant="ghost"
        size="sm"
        :disabled="!interactive"
        :aria-label="t('imageCropper.rotateRight')"
        @click="rotate(90)"
      >
        <RotateCwIcon />
      </DouButton>
      <DouButton
        variant="ghost"
        size="sm"
        :disabled="!interactive"
        :aria-label="t('imageCropper.reset')"
        @click="reset()"
      >
        <RefreshIcon />
      </DouButton>
    </div>
  </div>
</template>
