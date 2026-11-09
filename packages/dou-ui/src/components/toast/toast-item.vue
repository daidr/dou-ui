<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useResizeObserver } from '../../composables/use-element-size'
import { useNamespace } from '../../utils/namespace'
import { toneIcon } from '../../utils/tone-icons'
import { useLocale } from '../config-provider/use-config'
import { DouSpinner } from '../spinner'
import { removeToast } from './store'
import type { ToastRecord } from './toast'

defineOptions({ name: 'DouToastItem' })

/** Where the stack puts this toast; see `toast-stack.vue`. */
export interface ToastItemLayout {
  /** Distance from the edge the stack hangs from, in px. */
  offset: number
  scale: number
  /** Height to show, in px; `undefined` until the toast is measured. */
  height?: number
  /** Stacked behind the newest one: only its edge shows. */
  behind: boolean
  /** Too deep in the stack to show at all. */
  hidden: boolean
  zIndex: number
}

const props = defineProps<{
  toast: ToastRecord
  layout: ToastItemLayout
  /** The stack is hovered, focused or opened by a tap: the countdown waits. */
  paused: boolean
}>()

const emit = defineEmits<{ resize: [height: number] }>()

const ns = useNamespace('toast')
const { t } = useLocale()

// The countdown pauses while the stack is held open, and resumes with
// whatever time was left.
let timer: ReturnType<typeof setTimeout> | undefined
let remaining = props.toast.duration
let startedAt = 0

function start() {
  if (props.paused || remaining <= 0 || timer) return
  startedAt = Date.now()
  timer = setTimeout(close, remaining)
}
function pause() {
  if (!timer) return
  clearTimeout(timer)
  timer = undefined
  remaining -= Date.now() - startedAt
}
watch(
  () => props.paused,
  (paused) => (paused ? pause() : start()),
)

// An update starts the countdown over with the new duration.
watch(
  () => props.toast.version,
  () => {
    clearTimeout(timer)
    timer = undefined
    remaining = props.toast.duration
    start()
  },
)
function close() {
  clearTimeout(timer)
  timer = undefined
  removeToast(props.toast.id)
}
function runAction() {
  props.toast.action?.onClick()
  close()
}

onMounted(start)
onBeforeUnmount(() => clearTimeout(timer))

// The stack sizes every toast itself, so it needs each one's own height:
// the content's, plus the border around it. Layout sizes, not the
// bounding box, which the stack's scale would shrink.
const root = ref<HTMLElement>()
const body = ref<HTMLElement>()
function measure() {
  if (!root.value || !body.value) return
  emit('resize', body.value.offsetHeight + root.value.offsetHeight - root.value.clientHeight)
}
onMounted(measure)
useResizeObserver(body, measure)

const role = computed(() =>
  props.toast.tone === 'danger' || props.toast.tone === 'warning' ? 'alert' : 'status',
)
const Icon = () => toneIcon(props.toast.tone)
</script>

<template>
  <li
    ref="root"
    :class="[
      ns.e('item'),
      ns.m(toast.tone),
      ns.is('behind', layout.behind),
      ns.is('hidden', layout.hidden),
    ]"
    :style="{
      '--dou-toast-offset': `${layout.offset}px`,
      '--dou-toast-scale': layout.scale,
      height: layout.height === undefined ? undefined : `${layout.height}px`,
      zIndex: layout.zIndex,
    }"
    :role="role"
    aria-atomic="true"
    :aria-busy="toast.loading || undefined"
  >
    <div ref="body" :class="ns.e('body')">
      <span v-if="toast.loading" :class="ns.e('icon')"><DouSpinner size="sm" /></span>
      <span v-else-if="toast.tone !== 'neutral'" :class="ns.e('icon')"><Icon /></span>
      <div :class="ns.e('content')">
        <div v-if="toast.title" :class="ns.e('title')">{{ toast.title }}</div>
        <div :class="ns.e('message')">{{ toast.message }}</div>
      </div>
      <button v-if="toast.action" type="button" :class="ns.e('action')" @click="runAction">
        {{ toast.action.label }}
      </button>
      <button
        v-if="toast.closable"
        type="button"
        :class="ns.e('close')"
        :aria-label="t('toast.close')"
        @click="close"
      >
        <CloseIcon />
      </button>
    </div>
  </li>
</template>
