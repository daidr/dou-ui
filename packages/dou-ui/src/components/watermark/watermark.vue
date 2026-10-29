<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { drawTile } from './draw'
import type { Tile } from './draw'
import type { WatermarkProps, WatermarkSlots } from './watermark'

defineOptions({ name: 'DouWatermark' })

const props = withDefaults(defineProps<WatermarkProps>(), {
  rotate: -22,
  gap: () => [100, 100],
  staggered: true,
  opacity: 0.12,
  fullscreen: false,
  zIndex: 9,
  protect: true,
})
defineSlots<WatermarkSlots>()

const ns = useNamespace('watermark')
const root = useTemplateRef<HTMLElement>('root')
const layer = useTemplateRef<HTMLElement>('layer')

const tile = shallowRef<Tile | null>(null)

const lines = computed(() =>
  props.content === undefined ? [] : Array.isArray(props.content) ? props.content : [props.content],
)

let drawing = 0
async function draw() {
  const ticket = ++drawing
  const container = root.value
  if (!container) return
  const fontSize = props.font?.size ?? 14
  const family = props.font?.family ?? getComputedStyle(container).fontFamily
  const font = `${props.font?.style ?? 'normal'} ${props.font?.weight ?? 400} ${fontSize}px ${family || 'sans-serif'}`

  let image: HTMLImageElement | undefined
  if (props.image) {
    image = await loadImage(props.image).catch(() => undefined)
    if (ticket !== drawing) return
  } else if (document.fonts?.ready) {
    await document.fonts.ready
    if (ticket !== drawing) return
  }
  if (props.image && !image) {
    tile.value = null
    return
  }
  tile.value = drawTile({
    lines: lines.value,
    image,
    width: props.width,
    height: props.height,
    rotate: props.rotate,
    gap: props.gap,
    staggered: props.staggered,
    font,
    fontSize,
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.addEventListener('load', () => resolve(image), { once: true })
    image.addEventListener('error', reject, { once: true })
    image.src = src
  })
}

const layerStyle = computed<CSSProperties>(() => {
  const value = tile.value
  const style: Record<string, string | number | undefined> = {
    zIndex: props.zIndex,
    opacity: props.opacity,
    '--dou-watermark-color': props.color,
  }
  if (!value) return style as CSSProperties
  const url = `url("${value.url}")`
  const size = `${value.width}px ${value.height}px`
  if (props.image) {
    style.backgroundImage = url
    style.backgroundSize = size
  } else {
    style.maskImage = url
    style.maskSize = size
    style.webkitMaskImage = url
    style.webkitMaskSize = size
  }
  return style as CSSProperties
})

// Put the layer back when it is removed or edited from outside. Changes
// made by the component itself are told apart by comparing against the
// attributes it last rendered.
const guarded = ['style', 'class', 'hidden', 'aria-hidden'] as const
let observer: MutationObserver | undefined
let rendered: Array<string | null> = []

function restore() {
  const container = root.value
  const current = layer.value
  if (!container || !current) return
  if (current.parentNode !== container) container.append(current)
  guarded.forEach((name, index) => {
    const value = rendered[index]
    if (current.getAttribute(name) === value) return
    if (value === null || value === undefined) current.removeAttribute(name)
    else current.setAttribute(name, value)
  })
}

function observe() {
  observer?.disconnect()
  const container = root.value
  const current = layer.value
  if (!props.protect || typeof MutationObserver === 'undefined' || !container || !current) return
  rendered = guarded.map((name) => current.getAttribute(name))
  observer = new MutationObserver(restore)
  observer.observe(container, { childList: true })
  observer.observe(current, { attributes: true })
}

onMounted(() => {
  void draw()
  observe()
})
onBeforeUnmount(() => observer?.disconnect())

watch(
  () => [
    lines.value.join('\n'),
    props.image,
    props.width,
    props.height,
    props.rotate,
    props.gap[0],
    props.gap[1],
    props.staggered,
    props.font?.size,
    props.font?.weight,
    props.font?.family,
    props.font?.style,
  ],
  () => void draw(),
)
// after the component's own updates, take a new snapshot
watch([layerStyle, () => props.protect], observe, { flush: 'post' })
</script>

<template>
  <div ref="root" :class="[ns.b(), ns.is('fullscreen', fullscreen)]">
    <slot />
    <div
      ref="layer"
      :class="[ns.e('layer'), ns.is('image', !!image)]"
      :style="layerStyle"
      aria-hidden="true"
    />
  </div>
</template>
