<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { toneIcon } from '../../utils/tone-icons'
import { useLocale } from '../config-provider/use-config'
import { DouSpinner } from '../spinner'
import { removeToast } from './store'
import type { ToastRecord } from './toast'

defineOptions({ name: 'DouToastItem' })

const props = defineProps<{ toast: ToastRecord }>()

const ns = useNamespace('toast')
const { t } = useLocale()

// The countdown pauses while the pointer or focus is on the toast, and
// resumes with whatever time was left.
let timer: ReturnType<typeof setTimeout> | undefined
let remaining = props.toast.duration
let startedAt = 0
let held = false

function start() {
  held = false
  if (remaining <= 0 || timer) return
  startedAt = Date.now()
  timer = setTimeout(close, remaining)
}
function pause() {
  held = true
  if (!timer) return
  clearTimeout(timer)
  timer = undefined
  remaining -= Date.now() - startedAt
}

// An update starts the countdown over with the new duration.
watch(
  () => props.toast.version,
  () => {
    clearTimeout(timer)
    timer = undefined
    remaining = props.toast.duration
    if (!held) start()
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

const role = computed(() =>
  props.toast.tone === 'danger' || props.toast.tone === 'warning' ? 'alert' : 'status',
)
const Icon = () => toneIcon(props.toast.tone)
</script>

<template>
  <li
    :class="[ns.e('item'), ns.m(toast.tone)]"
    :role="role"
    aria-atomic="true"
    :aria-busy="toast.loading || undefined"
    @mouseenter="pause"
    @mouseleave="start"
    @focusin="pause"
    @focusout="start"
  >
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
  </li>
</template>
