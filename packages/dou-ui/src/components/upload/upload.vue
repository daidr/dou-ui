<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { DouButton } from '../button'
import { DouProgress } from '../progress'
import { formatFileSize, matchesAccept } from './upload'
import type { UploadExpose, UploadFile, UploadProps, UploadSlots } from './upload'

defineOptions({ name: 'DouUpload' })

const props = withDefaults(defineProps<UploadProps>(), {
  multiple: false,
  disabled: false,
  dropzone: false,
  autoUpload: true,
  showList: true,
})
const model = defineModel<UploadFile[]>({ default: () => [] })
const emit = defineEmits<{
  change: [files: UploadFile[]]
  exceed: [files: File[]]
  reject: [file: File, reason: 'type' | 'size']
  success: [file: UploadFile, response: unknown]
  error: [file: UploadFile, error: unknown]
  remove: [file: UploadFile]
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

async function add(picked: File[]) {
  if (disabled.value || !picked.length) return
  let chosen = props.multiple ? picked : picked.slice(0, 1)

  const accepted: File[] = []
  for (const file of chosen) {
    if (!matchesAccept(file, props.accept)) emit('reject', file, 'type')
    else if (props.maxSize !== undefined && file.size > props.maxSize) emit('reject', file, 'size')
    else accepted.push(file)
  }
  chosen = accepted

  // Without `multiple`, a new file replaces the old one.
  if (props.maxCount !== undefined) {
    const room = Math.max(0, props.maxCount - (props.multiple ? files.value.length : 0))
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
      size: file.size,
      type: file.type,
      status: 'ready',
      raw: file,
      url,
    })
  }
  if (!entries.length) return

  if (!props.multiple) for (const file of files.value) release(file.uid)
  commit([...(props.multiple ? files.value : []), ...entries])
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
  void add([...(event.dataTransfer?.files ?? [])])
}

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

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('disabled', disabled.value),
  ns.is('dropzone', props.dropzone),
])
</script>

<template>
  <div :class="classes">
    <input
      :id="formItem?.inputId"
      ref="input"
      type="file"
      :class="ns.e('native')"
      :accept="accept"
      :multiple="multiple"
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path
            d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M4 14v3a3 3 0 003 3h10a3 3 0 003-3v-3" stroke-linecap="round" />
        </svg>
      </span>
      <span :class="ns.e('zone-text')">
        {{ t('upload.drop') }}<span :class="ns.e('zone-link')">{{ t('upload.browse') }}</span>
      </span>
      <span v-if="hasHint" :id="hintId" :class="ns.e('hint')">
        <slot name="hint">{{ hint }}</slot>
      </span>
    </div>
    <template v-else>
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
              <svg
                width="1em"
                height="1em"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  d="M8 10.5V2.75m0 0L5 5.75m3-3l3 3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path d="M2.75 10v1.25a2 2 0 002 2h6.5a2 2 0 002-2V10" stroke-linecap="round" />
              </svg>
            </template>
            {{ t('upload.choose') }}
          </DouButton>
        </slot>
      </span>
      <span v-if="hasHint" :id="hintId" :class="ns.e('hint')">
        <slot name="hint">{{ hint }}</slot>
      </span>
    </template>

    <ul v-if="showList && files.length" :class="ns.e('list')" :aria-label="t('upload.list')">
      <li v-for="file in files" :key="file.uid" :class="[ns.e('file'), ns.is(file.status)]">
        <slot
          name="file"
          :file="file"
          :remove="() => remove(file.uid)"
          :retry="() => send(file.uid)"
        >
          <span :class="ns.e('thumb')" aria-hidden="true">
            <img v-if="isImage(file)" :src="file.url" alt="" />
            <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25">
              <path
                d="M9.25 1.75H4.5a1.5 1.5 0 00-1.5 1.5v9.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5V5.5L9.25 1.75z"
                stroke-linejoin="round"
              />
              <path d="M9.25 1.75V5.5H13" stroke-linejoin="round" />
            </svg>
          </span>
          <span :class="ns.e('meta')">
            <span :class="ns.e('name')">
              <a
                v-if="file.url && file.status === 'success'"
                :href="file.url"
                target="_blank"
                rel="noopener noreferrer"
                >{{ file.name }}</a
              >
              <template v-else>{{ file.name }}</template>
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
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path
                  d="M13 8a5 5 0 11-1.46-3.54M13 3v2.5h-2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              :class="ns.e('action')"
              :aria-label="`${t('upload.remove')} ${file.name}`"
              :disabled="disabled"
              @click="remove(file.uid)"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M5 5l6 6M11 5l-6 6" stroke-linecap="round" />
              </svg>
            </button>
          </span>
        </slot>
      </li>
    </ul>
  </div>
</template>
