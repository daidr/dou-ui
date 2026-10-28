<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../../utils/clipboard'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { CopyButtonProps } from './copy-button'

defineOptions({ name: 'DouCopyButton' })

const props = withDefaults(defineProps<CopyButtonProps>(), {
  text: '',
  showLabel: false,
  size: 'md',
  variant: 'ghost',
  duration: 2000,
  disabled: false,
})
const emit = defineEmits<{ copy: [text: string]; error: [error: unknown] }>()

const ns = useNamespace('copy-button')
const { t } = useLocale()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(timer))

async function copy() {
  if (props.disabled) return
  try {
    const text = typeof props.text === 'function' ? await props.text() : props.text
    await copyText(text)
    copied.value = true
    emit('copy', text)
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), props.duration)
  } catch (error) {
    emit('error', error)
  }
}

const label = computed(() => props.label ?? t('copyButton.copy'))
const copiedLabel = computed(() => props.copiedLabel ?? t('copyButton.copied'))
</script>

<template>
  <button
    type="button"
    :class="[
      ns.b(),
      ns.m(size),
      ns.m(variant),
      ns.is('copied', copied),
      ns.is('labelled', showLabel),
    ]"
    :disabled="disabled"
    :aria-label="copied ? copiedLabel : label"
    :title="showLabel ? undefined : copied ? copiedLabel : label"
    @click="copy"
  >
    <svg
      v-if="copied"
      :class="ns.e('icon')"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
    <svg
      v-else
      :class="ns.e('icon')"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.75" />
      <path
        d="M10.5 5.5V4.25c0-.97-.78-1.75-1.75-1.75h-4.5c-.97 0-1.75.78-1.75 1.75v4.5c0 .97.78 1.75 1.75 1.75H5.5"
      />
    </svg>
    <span v-if="showLabel" :class="ns.e('label')">{{ copied ? copiedLabel : label }}</span>
    <span :class="ns.e('status')" role="status">{{ copied ? copiedLabel : '' }}</span>
  </button>
</template>
