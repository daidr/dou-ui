<script setup lang="ts">
import {
  CloseIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
} from '@dou-ui/icons'
import type { Component } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useStatusCheck } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import { formatFileSize } from '../upload/upload'
import { attachmentKind, fileExtension } from './chat-attachments'
import type {
  ChatAttachment,
  ChatAttachmentKind,
  ChatAttachmentsEmits,
  ChatAttachmentsProps,
  ChatAttachmentsSlots,
} from './chat-attachments'

defineOptions({ name: 'DouChatAttachments' })

const props = withDefaults(defineProps<ChatAttachmentsProps>(), {
  modelValue: () => [],
  removable: true,
})
const emit = defineEmits<ChatAttachmentsEmits>()
defineSlots<ChatAttachmentsSlots>()

const ns = useNamespace('chat-attachments')
const { t } = useLocale()

const icons: Record<ChatAttachmentKind, Component> = {
  image: FileImageIcon,
  video: FileVideoIcon,
  audio: FileAudioIcon,
  archive: FileArchiveIcon,
  code: FileCodeIcon,
  spreadsheet: FileSpreadsheetIcon,
  text: FileTextIcon,
  file: FileIcon,
}

useStatusCheck(
  'DouChatAttachments',
  () => (props.modelValue ?? []).map((file) => file.status),
  ['running', 'done', 'error'],
  { uploading: 'running', success: 'done' },
)

const isThumb = (file: ChatAttachment) => !!file.url && attachmentKind(file) === 'image'

function detail(file: ChatAttachment) {
  if (file.status === 'running') return `${t('chat.uploading')} ${Math.round(file.percent ?? 0)}%`
  if (file.status === 'error') return t('chat.uploadError')
  return [fileExtension(file.name), file.size === undefined ? '' : formatFileSize(file.size)]
    .filter(Boolean)
    .join(' · ')
}

function remove(file: ChatAttachment) {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item.uid !== file.uid),
  )
  emit('remove', file)
}
</script>

<template>
  <ul :class="ns.b()" :aria-label="t('chat.attachments')">
    <li
      v-for="file in modelValue"
      :key="file.uid"
      :class="[ns.e('item'), ns.is('thumb', isThumb(file)), file.status ? ns.is(file.status) : '']"
    >
      <slot name="item" :file="file" :remove="() => remove(file)">
        <button
          type="button"
          :class="ns.e('main')"
          :title="file.name"
          :aria-label="isThumb(file) ? file.name : undefined"
          @click="emit('open', file)"
        >
          <img v-if="isThumb(file)" :class="ns.e('image')" :src="file.url" alt="" />
          <template v-else>
            <span :class="ns.e('icon')" aria-hidden="true">
              <component :is="icons[attachmentKind(file)]" />
            </span>
            <span :class="ns.e('meta')">
              <span :class="ns.e('name')">{{ file.name }}</span>
              <span :class="ns.e('detail')">{{ detail(file) }}</span>
            </span>
          </template>
          <span
            v-if="file.status === 'running'"
            :class="ns.e('progress')"
            role="progressbar"
            :aria-label="file.name"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(file.percent ?? 0)"
          >
            <span :style="{ width: `${file.percent ?? 0}%` }" />
          </span>
        </button>
        <button
          v-if="removable"
          type="button"
          :class="ns.e('remove')"
          :aria-label="`${t('chat.remove')} ${file.name}`"
          @click="remove(file)"
        >
          <CloseIcon />
        </button>
      </slot>
    </li>
  </ul>
</template>
