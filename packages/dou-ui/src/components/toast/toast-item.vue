<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { toneIcon } from '../../utils/tone-icons'
import { useLocale } from '../config-provider/use-config'
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

function start() {
  if (remaining <= 0 || timer) return
  startedAt = Date.now()
  timer = setTimeout(close, remaining)
}
function pause() {
  if (!timer) return
  clearTimeout(timer)
  timer = undefined
  remaining -= Date.now() - startedAt
}
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
    @mouseenter="pause"
    @mouseleave="start"
    @focusin="pause"
    @focusout="start"
  >
    <span v-if="toast.tone !== 'neutral'" :class="ns.e('icon')"><Icon /></span>
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
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke-linecap="round" />
      </svg>
    </button>
  </li>
</template>
