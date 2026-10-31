<script setup lang="ts">
import { CheckIcon, CopyIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import { useClipboard } from '../../composables/use-clipboard'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouTooltip } from '../tooltip'
import type { CopyButtonProps } from './copy-button'

// The root is the tooltip, so attributes go on the button by hand.
defineOptions({ name: 'DouCopyButton', inheritAttrs: false })

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

const clipboard = useClipboard({ duration: () => props.duration })
const copied = clipboard.copied

async function copy() {
  if (props.disabled) return
  try {
    const text = typeof props.text === 'function' ? await props.text() : props.text
    await clipboard.copy(text)
    emit('copy', text)
  } catch (error) {
    emit('error', error)
  }
}

const label = computed(() => props.label ?? t('copyButton.copy'))
const copiedLabel = computed(() => props.copiedLabel ?? t('copyButton.copied'))
</script>

<template>
  <!-- Only the icon shows: its name goes in a tooltip. -->
  <DouTooltip :content="copied ? copiedLabel : label" :disabled="showLabel">
    <button
      v-bind="$attrs"
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
      @click="copy"
    >
      <CheckIcon v-if="copied" :class="ns.e('icon')" />
      <CopyIcon v-else :class="ns.e('icon')" />
      <span v-if="showLabel" :class="ns.e('label')">{{ copied ? copiedLabel : label }}</span>
      <span :class="ns.e('status')" role="status">{{ copied ? copiedLabel : '' }}</span>
    </button>
  </DouTooltip>
</template>
