<script setup lang="ts">
import {
  DownloadIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  PaperclipIcon,
  UploadIcon,
} from '@dou-ui/icons'
import { DouButton, DouSpinner, DouTooltip } from 'dou-ui'
import { computed, useTemplateRef } from 'vue'
import type { BlockProps } from '../../core/model'
import { useEditor } from '../../editor'
import type { Uploads } from '../image/uploads'
import { fileKind, formatFileSize, isSafeFileSrc } from './files'

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
  uploads: Uploads
  accept?: string
}>()

const { messages, view } = useEditor()
const text = computed(() => messages.value.attachment)

const src = computed(() => {
  const value = String(props.block.props.src ?? '')
  return value && isSafeFileSrc(value) ? value : ''
})
const name = computed(
  () =>
    String(props.block.props.name ?? '') || src.value.split(/[/?#]/).filter(Boolean).at(-1) || '',
)
const size = computed(() => formatFileSize(props.block.props.size ?? ''))
const upload = computed(() => props.uploads.items.get(props.block.id))
const icons = {
  image: FileImageIcon,
  video: FileVideoIcon,
  audio: FileAudioIcon,
  archive: FileArchiveIcon,
  spreadsheet: FileSpreadsheetIcon,
  text: FileTextIcon,
  other: FileIcon,
}
const icon = computed(() => icons[fileKind(String(props.block.props.mime ?? ''), name.value)])

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function pick() {
  fileInput.value?.click()
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file && view.value) props.uploads.start(view.value, props.block.id, file)
}
</script>

<template>
  <div class="dou-editor-attachment" :class="{ 'is-selected': selected }">
    <div v-if="src || upload || name" class="dou-editor-attachment__card">
      <component :is="icon" class="dou-editor-attachment__icon" />
      <div class="dou-editor-attachment__text">
        <span class="dou-editor-attachment__name">{{ name }}</span>
        <span class="dou-editor-attachment__meta">
          <template v-if="upload && !upload.failed">
            <DouSpinner size="sm" />
            {{ text.uploading }}
          </template>
          <template v-else-if="upload?.failed">{{ text.failed }}</template>
          <template v-else>{{ size }}</template>
        </span>
      </div>
      <DouButton v-if="upload?.failed && editable" size="sm" variant="outline" @click="pick">
        {{ text.retry }}
      </DouButton>
      <DouTooltip v-else-if="src" :content="text.download">
        <a
          class="dou-editor-attachment__download"
          :href="src"
          :download="name || ''"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${text.download} ${name}`"
          data-editor-control
        >
          <DownloadIcon />
        </a>
      </DouTooltip>
    </div>

    <div v-else-if="editable" class="dou-editor-image__empty">
      <PaperclipIcon class="dou-editor-image__empty-icon" />
      <span class="dou-editor-image__empty-text">{{ text.empty }}</span>
      <DouButton size="sm" variant="outline" @click="pick">
        <template #leading><UploadIcon /></template>
        {{ text.upload }}
      </DouButton>
    </div>

    <input v-if="editable" ref="fileInput" type="file" :accept="accept" hidden @change="onFile" />
  </div>
</template>
