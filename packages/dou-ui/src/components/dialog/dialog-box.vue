<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { isComposing } from '../../utils/keyboard'
import { useNamespace } from '../../utils/namespace'
import { toneIcon } from '../../utils/tone-icons'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { DouInput } from '../input'
import Dialog from './dialog.vue'
import type { DialogBoxState } from './dialog-api'

defineOptions({ name: 'DouDialogBox' })

const props = defineProps<{
  options: DialogBoxState
  /** Filled in with a way to cancel from outside. */
  controller: { close?: () => void }
}>()
const emit = defineEmits<{
  /** The answer: `true` / the value for confirm, `false` / `null` for cancel. */
  settle: [confirmed: boolean, value: string]
  closed: []
}>()

const ns = useNamespace('dialog-box')
const { t } = useLocale()
const id = `dou-dialog-box-${useId()}`

const open = ref(true)
const pending = ref(false)
const value = ref(props.options.defaultValue ?? '')
const invalid = ref(false)
const error = ref('')

const kind = computed(() => props.options.kind)
const tone = computed(() => props.options.tone)
const danger = computed(() => tone.value === 'danger')
const Icon = () => (tone.value && tone.value !== 'neutral' ? toneIcon(tone.value) : null)
const Content = () => {
  const { content } = props.options
  return typeof content === 'function' ? content() : content
}

let settled = false
function settle(confirmed: boolean) {
  if (settled) return
  settled = true
  emit('settle', confirmed, value.value)
  open.value = false
}

async function confirm() {
  if (pending.value) return
  pending.value = true
  try {
    if (kind.value === 'prompt' && props.options.validate) {
      const result = await props.options.validate(value.value)
      if (result === false || typeof result === 'string') {
        invalid.value = true
        error.value = typeof result === 'string' ? result : ''
        return
      }
    }
    await props.options.onConfirm?.(value.value)
    settle(true)
  } catch {
    // A rejected confirm keeps the dialog open, so it can be tried again.
  } finally {
    pending.value = false
  }
}

// Escape, the mask and the close button all answer "cancel", but not while
// the confirm action is running.
function beforeClose() {
  if (pending.value) return false
  settle(false)
}

function clearError() {
  invalid.value = false
  error.value = ''
}

function onEnter(event: KeyboardEvent) {
  if (isComposing(event)) return
  event.preventDefault()
  void confirm()
}

// oxlint-disable-next-line vue/no-mutating-props -- the controller is a handle made for this
props.controller.close = () => {
  if (!pending.value) settle(false)
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :class="[ns.b(), tone && ns.m(tone)]"
    :width="options.width ?? 420"
    :closable="false"
    :close-on-mask="options.closeOnMask ?? false"
    :close-on-escape="options.closeOnEscape ?? true"
    :before-close="beforeClose"
    :role="kind === 'prompt' ? 'dialog' : 'alertdialog'"
    :aria-labelledby="options.title ? `${id}-title` : undefined"
    :aria-describedby="options.content ? `${id}-content` : undefined"
    @closed="emit('closed')"
  >
    <div :class="ns.e('main')">
      <span v-if="tone && tone !== 'neutral'" :class="ns.e('icon')"><Icon /></span>
      <div :class="ns.e('text')">
        <div
          v-if="options.title"
          :id="`${id}-title`"
          role="heading"
          aria-level="2"
          :class="ns.e('title')"
        >
          {{ options.title }}
        </div>
        <div v-if="options.content" :id="`${id}-content`" :class="ns.e('content')">
          <Content />
        </div>
        <div v-if="kind === 'prompt'" :class="ns.e('field')">
          <DouInput
            v-model="value"
            :type="options.inputType"
            :placeholder="options.placeholder"
            :invalid="invalid"
            :aria-label="options.title"
            :aria-describedby="error ? `${id}-error` : undefined"
            autofocus
            @keydown.enter="onEnter"
            @update:model-value="clearError"
          />
          <div v-if="invalid && error" :id="`${id}-error`" :class="ns.e('error')" role="alert">
            {{ error }}
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <DouButton
        v-if="kind !== 'alert'"
        variant="outline"
        :class="ns.e('cancel')"
        :disabled="pending"
        :autofocus="danger || undefined"
        @click="settle(false)"
      >
        {{ options.cancelText ?? t('dialog.cancel') }}
      </DouButton>
      <DouButton
        :tone="danger ? 'danger' : 'neutral'"
        :class="ns.e('confirm')"
        :loading="pending"
        :autofocus="(kind !== 'prompt' && !danger) || undefined"
        @click="confirm"
      >
        {{ options.confirmText ?? t('dialog.confirm') }}
      </DouButton>
    </template>
  </Dialog>
</template>
