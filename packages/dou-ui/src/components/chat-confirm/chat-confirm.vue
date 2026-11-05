<script setup lang="ts">
import { CheckIcon, CloseIcon, ShieldIcon, UndoIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useStatusCheck } from '../../utils/status-check'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import type { ChatConfirmEmits, ChatConfirmProps, ChatConfirmSlots } from './chat-confirm'

defineOptions({ name: 'DouChatConfirm' })

const props = withDefaults(defineProps<ChatConfirmProps>(), {
  status: 'waiting',
  allowAlways: false,
  tone: 'neutral',
})
const emit = defineEmits<ChatConfirmEmits>()
const slots = defineSlots<ChatConfirmSlots>()

const ns = useNamespace('chat-confirm')
const { t } = useLocale()
const id = useId()

const waiting = computed(() => props.status === 'waiting')
// How each answered or withdrawn request reads once it has collapsed.
const outcomes = {
  approved: { icon: CheckIcon, text: 'chat.approved' },
  denied: { icon: CloseIcon, text: 'chat.denied' },
  withdrawn: { icon: UndoIcon, text: 'chat.withdrawn' },
} as const
const outcome = computed(() =>
  Object.hasOwn(outcomes, props.status)
    ? outcomes[props.status as keyof typeof outcomes]
    : undefined,
)

// Answering or withdrawing removes the buttons; if focus was on one, keep it
// on the card instead of losing it to the page. The watcher runs before the
// DOM updates, while the focused button is still there to find.
const root = ref<HTMLElement>()
watch(
  () => props.status,
  (now, before) => {
    if (before !== 'waiting' || now === 'waiting') return
    if (!root.value?.contains(document.activeElement)) return
    void nextTick(() => root.value?.focus({ preventScroll: true }))
  },
)

const statuses = ['waiting', 'approved', 'denied', 'withdrawn']
useStatusCheck('DouChatConfirm', () => [props.status], statuses, { pending: 'waiting' })
</script>

<template>
  <div
    ref="root"
    :class="[ns.b(), ns.m(tone), ns.is(status)]"
    role="group"
    tabindex="-1"
    :aria-labelledby="title || slots.title ? `${id}-title` : undefined"
  >
    <div :class="ns.e('header')">
      <span :class="ns.e('icon')" aria-hidden="true">
        <slot name="icon"><ShieldIcon /></slot>
      </span>
      <div :class="ns.e('text')">
        <div v-if="title || slots.title" :id="`${id}-title`" :class="ns.e('title')">
          <slot name="title">{{ title }}</slot>
        </div>
        <div v-if="description" :class="ns.e('description')">{{ description }}</div>
      </div>
      <!-- always there, so screen readers announce the outcome when it appears -->
      <span :class="ns.e('result')" role="status">
        <template v-if="outcome">
          <component :is="outcome.icon" aria-hidden="true" />
          {{ t(outcome.text) }}
        </template>
      </span>
    </div>
    <div v-if="slots.default" :class="ns.e('detail')"><slot /></div>
    <div v-if="waiting" :class="ns.e('actions')">
      <DouButton size="sm" variant="outline" @click="emit('decide', 'deny')">
        {{ denyText ?? t('chat.deny') }}
      </DouButton>
      <DouButton v-if="allowAlways" size="sm" variant="outline" @click="emit('decide', 'always')">
        {{ t('chat.allowAlways') }}
      </DouButton>
      <DouButton
        size="sm"
        :tone="tone === 'danger' ? 'danger' : 'neutral'"
        @click="emit('decide', 'approve')"
      >
        {{ approveText ?? t('chat.approve') }}
      </DouButton>
    </div>
  </div>
</template>
