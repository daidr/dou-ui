<script setup lang="ts">
import {
  CloseIcon,
  FileIcon,
  PlusIcon,
  RotateCwIcon,
  TrashIcon,
  UploadIcon,
  ZoomInIcon,
} from '@dou-ui/icons'
import { computed, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { DouButton } from '../button'
import { DouImagePreview } from '../image'
import { DouProgress } from '../progress'
import { formatFileSize, matchesAccept } from './upload'
import type { UploadExpose, UploadFile, UploadProps, UploadSlots } from './upload'

defineOptions({ name: 'DouUpload' })

const props = withDefaults(defineProps<UploadProps>(), {
  listType: 'text',
  preview: true,
  multiple: false,
  disabled: false,
  dropzone: false,
  autoUpload: true,
  showList: true,
  directory: false,
  pasteTarget: false,
})
const model = defineModel<UploadFile[]>({ default: () => [] })
const emit = defineEmits<{
  change: [files: UploadFile[]]
  exceed: [files: File[]]
  reject: [file: File, reason: 'type' | 'size']
  success: [file: UploadFile, response: unknown]
  error: [file: UploadFile, error: unknown]
  remove: [file: UploadFile]
  preview: [file: UploadFile]
}>()
const slots = defineSlots<UploadSlots>()

const ns = useNamespace('upload')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const id = `dou-upload-${useId()}`
const hintId = `${id}-hint`

const inputRef = useTemplateRef<HTMLInputElement>('input')
const rootRef = useTemplateRef<HTMLElement>('root')

let seed = 0
const nextUid = () => `${id}-${Date.now().toString(36)}-${seed++}`

// Previews made for picked images, released when their file goes.
const previews = new Map<string, string>()
const controllers = new Map<string, AbortController>()

// The list as it is now. A bound `v-model` only catches up on the next
// render, and progress from several files can land before that.
const files = ref<UploadFile[]>(model.value)
watch(model, (value) => {
  if (value !== files.value) files.value = value
})

function commit(next: UploadFile[]) {
  files.value = next
  model.value = next
  emit('change', next)
  formItem?.trigger('change')
}

const find = (uid: string) => files.value.find((file) => file.uid === uid)

function patch(uid: string, changes: Partial<UploadFile>) {
  if (!find(uid)) return
  commit(files.value.map((file) => (file.uid === uid ? { ...file, ...changes } : file)))
}

function open() {
  if (disabled.value) return
  inputRef.value?.click()
}

// Paths of files read out of dropped folders; picked ones carry `webkitRelativePath`.
const folderPaths = new WeakMap<File, string>()
const pathOf = (file: File) => folderPaths.get(file) || file.webkitRelativePath || undefined

async function add(picked: File[]) {
  if (disabled.value || !picked.length) return
  let chosen = props.multiple || props.directory ? picked : picked.slice(0, 1)

  const accepted: File[] = []
  for (const file of chosen) {
    if (!matchesAccept(file, props.accept)) emit('reject', file, 'type')
    else if (props.maxSize !== undefined && file.size > props.maxSize) emit('reject', file, 'size')
    else accepted.push(file)
  }
  chosen = accepted

  // Without `multiple`, a new file replaces the old one.
  if (props.maxCount !== undefined) {
    const keeps = props.multiple || props.directory
    const room = Math.max(0, props.maxCount - (keeps ? files.value.length : 0))
    if (chosen.length > room) {
      emit('exceed', chosen.slice(room))
      chosen = chosen.slice(0, room)
    }
  }

  const entries: UploadFile[] = []
  for (const original of chosen) {
    let file = original
    if (props.beforeUpload) {
      const result = await props.beforeUpload(original)
      if (result === false) continue
      if (result instanceof File) file = result
    }
    const uid = nextUid()
    let url: string | undefined
    if (file.type.startsWith('image/') && typeof URL.createObjectURL === 'function') {
      url = URL.createObjectURL(file)
      previews.set(uid, url)
    }
    entries.push({
      uid,
      name: file.name,
      path: pathOf(original),
      size: file.size,
      type: file.type,
      status: 'ready',
      raw: file,
      url,
    })
  }
  if (!entries.length) return

  const keeps = props.multiple || props.directory
  if (!keeps) for (const file of files.value) release(file.uid)
  commit([...(keeps ? files.value : []), ...entries])
  if (props.autoUpload) for (const entry of entries) void send(entry.uid)
}

async function send(uid: string) {
  const file = find(uid)
  if (!props.request || !file?.raw || file.status === 'uploading') return
  const controller = new AbortController()
  controllers.set(uid, controller)
  patch(uid, { status: 'uploading', percent: 0, error: undefined })
  try {
    const response = await props.request({
      file: find(uid)!,
      raw: file.raw,
      signal: controller.signal,
      onProgress: (percent) => {
        if (!controller.signal.aborted) patch(uid, { percent: Math.min(100, Math.max(0, percent)) })
      },
    })
    if (controller.signal.aborted) return
    patch(uid, { status: 'success', percent: 100, response })
    const done = find(uid)
    if (done) emit('success', done, response)
  } catch (error) {
    if (controller.signal.aborted) return
    patch(uid, { status: 'error', error })
    const failed = find(uid)
    if (failed) emit('error', failed, error)
  } finally {
    if (controllers.get(uid) === controller) controllers.delete(uid)
  }
}

function abort(uid?: string) {
  const uids = uid === undefined ? [...controllers.keys()] : [uid]
  for (const key of uids) {
    const controller = controllers.get(key)
    if (!controller) continue
    controller.abort()
    controllers.delete(key)
    patch(key, { status: 'ready', percent: undefined })
  }
}

function release(uid: string) {
  controllers.get(uid)?.abort()
  controllers.delete(uid)
  const url = previews.get(uid)
  if (url) URL.revokeObjectURL(url)
  previews.delete(uid)
}

function remove(uid: string) {
  const file = find(uid)
  if (!file || disabled.value) return
  release(uid)
  commit(files.value.filter((item) => item.uid !== uid))
  emit('remove', file)
}

function submit() {
  for (const file of files.value) {
    if (file.status === 'ready' || file.status === 'error') void send(file.uid)
  }
}

onBeforeUnmount(() => {
  for (const controller of controllers.values()) controller.abort()
  for (const url of previews.values()) URL.revokeObjectURL(url)
})

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  void add([...(input.files ?? [])])
  // Picking the same file again should fire `change` again.
  input.value = ''
}

/* dropping */

const dragging = ref(false)
let depth = 0
function onDragenter(event: DragEvent) {
  if (disabled.value) return
  event.preventDefault()
  depth++
  dragging.value = true
}
function onDragover(event: DragEvent) {
  if (disabled.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}
function onDragleave() {
  depth = Math.max(0, depth - 1)
  if (!depth) dragging.value = false
}
function onDrop(event: DragEvent) {
  if (disabled.value) return
  event.preventDefault()
  depth = 0
  dragging.value = false
  const transfer = event.dataTransfer
  // Entries must be taken while the event lasts; reading them comes after.
  const entries = props.directory
    ? [...(transfer?.items ?? [])]
        .map((item) => item.webkitGetAsEntry?.())
        .filter((entry) => !!entry)
    : []
  if (entries.length) void readEntries(entries).then(add)
  else void add([...(transfer?.files ?? [])])
}

/** Every file under dropped entries, depth first, with its path inside the folder. */
async function readEntries(entries: FileSystemEntry[]) {
  const result: File[] = []
  const visit = async (entry: FileSystemEntry) => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      )
      folderPaths.set(file, entry.fullPath.replace(/^\//, ''))
      result.push(file)
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      // a reader hands entries over in batches until it returns none
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        )
        if (!batch.length) break
        for (const child of batch) await visit(child)
      }
    }
  }
  for (const entry of entries) await visit(entry).catch(() => {})
  return result
}

/* pasting */

function onPaste(event: Event) {
  const pasted = [...((event as ClipboardEvent).clipboardData?.files ?? [])]
  if (disabled.value || !pasted.length) return
  event.preventDefault()
  void add(pasted)
}

let pasteListener: EventTarget | null = null
function bindPaste() {
  pasteListener?.removeEventListener('paste', onPaste)
  const target = props.pasteTarget
  pasteListener =
    target === true
      ? rootRef.value
      : target === 'document'
        ? document
        : typeof target === 'string'
          ? document.querySelector(target)
          : target || null
  pasteListener?.addEventListener('paste', onPaste)
}
onMounted(() => {
  bindPaste()
  watch(() => props.pasteTarget, bindPaste)
})
onBeforeUnmount(() => pasteListener?.removeEventListener('paste', onPaste))

function onZoneKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  open()
}

const isImage = (file: UploadFile) =>
  !!file.url &&
  (file.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.url))

function statusText(file: UploadFile) {
  if (file.status === 'uploading')
    return `${t('upload.uploading')} ${Math.round(file.percent ?? 0)}%`
  if (file.status === 'error') return t('upload.error')
  return ''
}

defineExpose<UploadExpose>({ open, submit, abort, retry: (uid) => void send(uid), remove })

const hasHint = computed(() => !!slots.hint || !!props.hint)
const full = computed(() => props.maxCount !== undefined && files.value.length >= props.maxCount)

const isCards = computed(() => props.listType === 'picture-card')

// the preview of a picture-card list steps through its images
const previewOpen = ref(false)
const previewIndex = ref(0)
const images = computed(() => files.value.filter(isImage))
function openPreview(file: UploadFile) {
  if (!isImage(file)) return
  emit('preview', file)
  if (!props.preview) return
  previewIndex.value = images.value.indexOf(file)
  previewOpen.value = true
}

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('disabled', disabled.value),
  ns.is('dropzone', props.dropzone),
  ns.is('cards', isCards.value),
])
</script>

<template>
  <div ref="root" :class="classes">
    <input
      :id="formItem?.inputId"
      ref="input"
      type="file"
      :class="ns.e('native')"
      :accept="accept"
      :multiple="multiple || directory"
      v-bind="directory ? { webkitdirectory: '' } : {}"
      :disabled="disabled"
      tabindex="-1"
      aria-hidden="true"
      @change="onChange"
    />
    <div
      v-if="dropzone"
      role="button"
      :tabindex="disabled ? -1 : 0"
      :class="[ns.e('zone'), ns.is('dragging', dragging)]"
      :aria-disabled="disabled || undefined"
      :aria-labelledby="formItem?.labelId"
      :aria-describedby="
        [hasHint ? hintId : '', formItem?.describedBy.value ?? ''].join(' ').trim() || undefined
      "
      :aria-invalid="formItem?.invalid.value || undefined"
      @click="open"
      @keydown="onZoneKeydown"
      @dragenter="onDragenter"
      @dragover="onDragover"
      @dragleave="onDragleave"
      @drop="onDrop"
    >
      <span :class="ns.e('zone-icon')" aria-hidden="true">
        <UploadIcon />
      </span>
      <span :class="ns.e('zone-text')">
        {{ t(directory ? 'upload.dropFolder' : 'upload.drop')
        }}<span :class="ns.e('zone-link')">{{ t('upload.browse') }}</span>
      </span>
      <span v-if="hasHint" :id="hintId" :class="ns.e('hint')">
        <slot name="hint">{{ hint }}</slot>
      </span>
    </div>
    <template v-else-if="!isCards">
      <span :class="ns.e('trigger')" @click="open">
        <slot>
          <DouButton
            variant="outline"
            :size="size"
            :disabled="disabled || full"
            :aria-describedby="
              [hasHint ? hintId : '', formItem?.describedBy.value ?? ''].join(' ').trim() ||
              undefined
            "
          >
            <template #leading>
              <UploadIcon />
            </template>
            {{ t(directory ? 'upload.chooseFolder' : 'upload.choose') }}
          </DouButton>
        </slot>
      </span>
      <span v-if="hasHint" :id="hintId" :class="ns.e('hint')">
        <slot name="hint">{{ hint }}</slot>
      </span>
    </template>

    <ul v-if="isCards" :class="ns.e('cards')" :aria-label="t('upload.list')">
      <li
        v-for="file in files"
        :key="file.uid"
        :class="[ns.e('card'), ns.is(file.status), ns.is('image', isImage(file))]"
      >
        <slot
          name="file"
          :file="file"
          :remove="() => remove(file.uid)"
          :retry="() => send(file.uid)"
        >
          <img v-if="isImage(file)" :class="ns.e('card-image')" :src="file.url" :alt="file.name" />
          <span v-else :class="ns.e('card-file')">
            <FileIcon />
            <span :class="ns.e('card-name')">{{ file.name }}</span>
          </span>
          <span
            v-if="file.status === 'uploading'"
            :class="ns.e('card-progress')"
            aria-live="polite"
          >
            <span>{{ statusText(file) }}</span>
            <DouProgress :value="file.percent ?? 0" size="sm" :label="file.name" />
          </span>
          <span v-else-if="file.status === 'error'" :class="ns.e('card-error')" aria-live="polite">
            {{ statusText(file) }}
          </span>
          <span :class="ns.e('card-actions')">
            <button
              v-if="isImage(file) && file.status !== 'uploading'"
              type="button"
              :class="ns.e('card-action')"
              :aria-label="`${t('upload.preview')} ${file.name}`"
              @click="openPreview(file)"
            >
              <ZoomInIcon />
            </button>
            <button
              v-if="file.status === 'error' && request"
              type="button"
              :class="ns.e('card-action')"
              :aria-label="`${t('upload.retry')} ${file.name}`"
              :disabled="disabled"
              @click="send(file.uid)"
            >
              <RotateCwIcon />
            </button>
            <button
              type="button"
              :class="ns.e('card-action')"
              :aria-label="`${t('upload.remove')} ${file.name}`"
              :disabled="disabled"
              @click="remove(file.uid)"
            >
              <TrashIcon />
            </button>
          </span>
        </slot>
      </li>
      <li v-if="!full && !dropzone" :class="ns.e('card-slot')" @click="open">
        <slot>
          <button
            type="button"
            :class="ns.e('card-trigger')"
            :disabled="disabled"
            :aria-describedby="
              [hasHint ? hintId : '', formItem?.describedBy.value ?? ''].join(' ').trim() ||
              undefined
            "
          >
            <PlusIcon />
            <span>{{ t(directory ? 'upload.chooseFolder' : 'upload.choose') }}</span>
          </button>
        </slot>
      </li>
    </ul>
    <span v-if="isCards && hasHint && !dropzone" :id="hintId" :class="ns.e('hint')">
      <slot name="hint">{{ hint }}</slot>
    </span>
    <DouImagePreview
      v-if="isCards && preview"
      v-model:open="previewOpen"
      v-model:index="previewIndex"
      :images="images.map((file) => ({ src: file.url!, alt: file.name }))"
    />

    <ul v-else-if="showList && files.length" :class="ns.e('list')" :aria-label="t('upload.list')">
      <li v-for="file in files" :key="file.uid" :class="[ns.e('file'), ns.is(file.status)]">
        <slot
          name="file"
          :file="file"
          :remove="() => remove(file.uid)"
          :retry="() => send(file.uid)"
        >
          <span :class="ns.e('thumb')" aria-hidden="true">
            <img v-if="isImage(file)" :src="file.url" alt="" />
            <FileIcon v-else />
          </span>
          <span :class="ns.e('meta')">
            <span :class="ns.e('name')">
              <a
                v-if="file.url && file.status === 'success'"
                :href="file.url"
                target="_blank"
                rel="noopener noreferrer"
                >{{ file.path ?? file.name }}</a
              >
              <template v-else>{{ file.path ?? file.name }}</template>
            </span>
            <span :class="ns.e('detail')">
              <span v-if="file.size !== undefined">{{ formatFileSize(file.size) }}</span>
              <span v-if="statusText(file)" :class="ns.e('status')" aria-live="polite">{{
                statusText(file)
              }}</span>
            </span>
            <DouProgress
              v-if="file.status === 'uploading'"
              :class="ns.e('progress')"
              :value="file.percent ?? 0"
              size="sm"
              :label="file.name"
            />
          </span>
          <span :class="ns.e('actions')">
            <button
              v-if="file.status === 'error' && request"
              type="button"
              :class="ns.e('action')"
              :aria-label="`${t('upload.retry')} ${file.name}`"
              :disabled="disabled"
              @click="send(file.uid)"
            >
              <RotateCwIcon />
            </button>
            <button
              type="button"
              :class="ns.e('action')"
              :aria-label="`${t('upload.remove')} ${file.name}`"
              :disabled="disabled"
              @click="remove(file.uid)"
            >
              <CloseIcon />
            </button>
          </span>
        </slot>
      </li>
    </ul>
  </div>
</template>
