<script setup lang="ts">
import { ImageIcon, LinkIcon, UploadIcon } from '@dou-ui/icons'
import { DouButton, DouInput, DouSpinner } from 'dou-ui'
import { computed, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import type { BlockProps } from '../../core/model'
import { useEditorContext } from '../../editor'
import { isSafeImageSrc, type Uploads } from './uploads'

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
  uploads: Uploads
}>()

const { messages, view } = useEditorContext()
const text = computed(() => messages.value.image)

const src = computed(() => {
  const value = String(props.block.props.src ?? '')
  return value && isSafeImageSrc(value) ? value : ''
})
const upload = computed(() => props.uploads.items.get(props.block.id))
const shown = computed(() => src.value || upload.value?.preview || '')
// without a width the image shows at its own size, up to the full line
const width = computed(() => {
  const value = Number(props.block.props.width)
  return value > 0 ? Math.min(100, Math.max(20, value)) : null
})
const caption = computed(() => String(props.block.props.caption ?? ''))

/* adding an image */

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const embedding = shallowRef(false)
const url = shallowRef('')

function pick() {
  fileInput.value?.click()
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file && view.value) props.uploads.start(view.value, props.block.id, file)
}

function embed() {
  const value = url.value.trim()
  if (!value || !isSafeImageSrc(value)) return
  props.updateProps({ src: value })
  embedding.value = false
  url.value = ''
}

/* resizing: the image stays centered, so a handle moves both edges */

const figure = useTemplateRef<HTMLElement>('figure')
const dragWidth = shallowRef<number | null>(null)
let stop: (() => void) | null = null

function startResize(event: PointerEvent, side: -1 | 1) {
  const container = figure.value?.parentElement
  if (!container || event.button !== 0) return
  event.preventDefault()
  const startX = event.clientX
  const total = container.getBoundingClientRect().width
  const startWidth = (figure.value!.getBoundingClientRect().width * 100) / total
  const onMove = (move: PointerEvent) => {
    const delta = ((move.clientX - startX) * side * 2 * 100) / total
    dragWidth.value = Math.round(Math.min(100, Math.max(20, startWidth + delta)))
  }
  const onUp = () => {
    stop?.()
    if (dragWidth.value !== null && dragWidth.value !== width.value)
      props.updateProps({ width: dragWidth.value })
    dragWidth.value = null
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  stop = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    stop = null
  }
}

onBeforeUnmount(() => stop?.())

function onCaption(value: string) {
  props.updateProps({ caption: value })
}
</script>

<template>
  <div class="dou-editor-image" :class="{ 'is-selected': selected }">
    <figure
      v-if="shown"
      ref="figure"
      class="dou-editor-image__figure"
      :class="{ 'is-sized': (dragWidth ?? width) !== null }"
      :style="(dragWidth ?? width) !== null ? { width: `${dragWidth ?? width}%` } : undefined"
    >
      <div class="dou-editor-image__frame">
        <img
          class="dou-editor-image__img"
          :src="shown"
          :alt="String(block.props.alt ?? '') || caption"
          draggable="false"
        />
        <div v-if="upload && !upload.failed" class="dou-editor-image__status">
          <DouSpinner size="sm" />
          {{ text.uploading }}
        </div>
        <div v-else-if="upload?.failed" class="dou-editor-image__status is-failed">
          {{ text.failed }}
          <DouButton v-if="editable" size="sm" variant="outline" @click="pick">
            <template #leading><UploadIcon /></template>
            {{ text.upload }}
          </DouButton>
        </div>
        <template v-if="editable && src">
          <span
            v-for="side in [-1, 1] as const"
            :key="side"
            class="dou-editor-image__handle"
            :class="side < 0 ? 'is-left' : 'is-right'"
            :title="text.resize"
            data-editor-control
            @pointerdown="startResize($event, side)"
          />
        </template>
      </div>
      <figcaption v-if="editable" class="dou-editor-image__caption">
        <input
          class="dou-editor-image__caption-input"
          :value="caption"
          :placeholder="text.caption"
          @change="onCaption(($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
      </figcaption>
      <figcaption v-else-if="caption" class="dou-editor-image__caption">{{ caption }}</figcaption>
    </figure>

    <div v-else-if="editable" class="dou-editor-image__empty">
      <ImageIcon class="dou-editor-image__empty-icon" />
      <template v-if="!embedding">
        <span class="dou-editor-image__empty-text">{{ text.empty }}</span>
        <div class="dou-editor-image__actions">
          <DouButton size="sm" variant="outline" @click="pick">
            <template #leading><UploadIcon /></template>
            {{ text.upload }}
          </DouButton>
          <DouButton size="sm" variant="ghost" @click="embedding = true">
            <template #leading><LinkIcon /></template>
            {{ text.embed }}
          </DouButton>
        </div>
      </template>
      <form v-else class="dou-editor-image__embed" @submit.prevent="embed">
        <DouInput
          v-model="url"
          size="sm"
          :placeholder="text.urlPlaceholder"
          autofocus
          @keydown.esc="embedding = false"
        />
        <DouButton size="sm" variant="solid" type="submit">{{ text.apply }}</DouButton>
      </form>
    </div>

    <input v-if="editable" ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
  </div>
</template>
