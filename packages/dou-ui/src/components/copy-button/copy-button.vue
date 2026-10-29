<script setup lang="ts">
import { CheckIcon, CopyIcon } from '@dou-ui/icons'
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
    <CheckIcon v-if="copied" :class="ns.e('icon')" />
    <CopyIcon v-else :class="ns.e('icon')" />
    <span v-if="showLabel" :class="ns.e('label')">{{ copied ? copiedLabel : label }}</span>
    <span :class="ns.e('status')" role="status">{{ copied ? copiedLabel : '' }}</span>
  </button>
</template>
