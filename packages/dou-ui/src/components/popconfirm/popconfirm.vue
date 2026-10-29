<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { toneIcon } from '../../utils/tone-icons'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { DouPopover } from '../popover'
import type { PopconfirmProps, PopconfirmSlots } from './popconfirm'

defineOptions({ name: 'DouPopconfirm', inheritAttrs: false })

const props = withDefaults(defineProps<PopconfirmProps>(), {
  tone: 'warning',
  placement: 'top',
  disabled: false,
  teleport: undefined,
})
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ cancel: [] }>()
const slots = defineSlots<PopconfirmSlots>()

const ns = useNamespace('popconfirm')
const { t } = useLocale()
const titleId = `dou-popconfirm-${useId()}-title`
const Icon = () => toneIcon(props.tone)

const pending = ref(false)
const actions = useTemplateRef<HTMLElement>('actions')

// Focus starts on "cancel": the safe answer is the one Enter gives.
// The panel renders on first open, so wait for it as well as for `open`.
watch(
  [open, actions],
  ([value, el], [was, before]) => {
    if (!value || !el || (was && before)) return
    pending.value = false
    // after this flush, once `v-show` has made the panel visible again
    void nextTick(() => el.querySelector<HTMLElement>(`.${ns.e('cancel')}`)?.focus())
  },
  { flush: 'post' },
)

async function confirm() {
  if (pending.value) return
  try {
    const result = props.onConfirm?.()
    if (result instanceof Promise) {
      pending.value = true
      await result
    }
    open.value = false
  } catch {
    // A rejected confirm keeps the question open, so it can be tried again.
  } finally {
    pending.value = false
  }
}

function cancel() {
  open.value = false
  emit('cancel')
}

const confirmTone = computed(() => (props.tone === 'danger' ? 'danger' : 'neutral'))
</script>

<template>
  <DouPopover
    v-model:open="open"
    trigger="click"
    :placement="placement"
    :disabled="disabled"
    :width="width"
    :teleport="teleport"
    v-bind="$attrs"
    :class="[ns.b(), ns.m(tone)]"
    role="alertdialog"
    :aria-labelledby="titleId"
  >
    <slot />
    <template #content>
      <div :class="ns.e('body')">
        <span :class="ns.e('icon')" aria-hidden="true">
          <slot name="icon"><Icon /></slot>
        </span>
        <div :class="ns.e('text')">
          <div :id="titleId" :class="ns.e('title')">
            <slot name="title">{{ title }}</slot>
          </div>
          <div v-if="slots.description || description" :class="ns.e('description')">
            <slot name="description">{{ description }}</slot>
          </div>
        </div>
      </div>
      <div ref="actions" :class="ns.e('actions')">
        <DouButton size="sm" variant="ghost" :class="ns.e('cancel')" @click="cancel">
          {{ cancelText ?? t('popconfirm.cancel') }}
        </DouButton>
        <DouButton
          size="sm"
          variant="solid"
          :tone="confirmTone"
          :loading="pending"
          :class="ns.e('confirm')"
          @click="confirm"
        >
          {{ confirmText ?? t('popconfirm.confirm') }}
        </DouButton>
      </div>
    </template>
  </DouPopover>
</template>
