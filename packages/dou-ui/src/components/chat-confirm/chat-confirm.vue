<script setup lang="ts">
import { CheckIcon, CloseIcon, ShieldIcon } from '@dou-ui/icons'
import { computed, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import type { ChatConfirmEmits, ChatConfirmProps, ChatConfirmSlots } from './chat-confirm'

defineOptions({ name: 'DouChatConfirm' })

const props = withDefaults(defineProps<ChatConfirmProps>(), {
  status: 'pending',
  allowAlways: false,
  danger: false,
})
const emit = defineEmits<ChatConfirmEmits>()
const slots = defineSlots<ChatConfirmSlots>()

const ns = useNamespace('chat-confirm')
const { t } = useLocale()
const id = useId()

const hasTitle = computed(() => !!props.title || !!slots.title)
const pending = computed(() => props.status === 'pending')
</script>

<template>
  <div
    :class="[ns.b(), ns.is(status), ns.is('danger', danger)]"
    role="group"
    :aria-labelledby="hasTitle ? `${id}-title` : undefined"
  >
    <div :class="ns.e('header')">
      <span :class="ns.e('icon')" aria-hidden="true">
        <slot name="icon"><ShieldIcon /></slot>
      </span>
      <div :class="ns.e('text')">
        <div v-if="hasTitle" :id="`${id}-title`" :class="ns.e('title')">
          <slot name="title">{{ title }}</slot>
        </div>
        <div v-if="description" :class="ns.e('description')">{{ description }}</div>
      </div>
      <span v-if="!pending" :class="ns.e('result')" role="status">
        <CheckIcon v-if="status === 'approved'" aria-hidden="true" />
        <CloseIcon v-else aria-hidden="true" />
        {{ status === 'approved' ? t('chat.approved') : t('chat.denied') }}
      </span>
    </div>
    <div v-if="slots.default" :class="ns.e('detail')"><slot /></div>
    <div v-if="pending" :class="ns.e('actions')">
      <DouButton size="sm" variant="outline" @click="emit('decide', 'deny')">
        {{ denyText ?? t('chat.deny') }}
      </DouButton>
      <DouButton v-if="allowAlways" size="sm" variant="outline" @click="emit('decide', 'always')">
        {{ t('chat.allowAlways') }}
      </DouButton>
      <DouButton size="sm" :tone="danger ? 'danger' : 'neutral'" @click="emit('decide', 'approve')">
        {{ approveText ?? t('chat.approve') }}
      </DouButton>
    </div>
  </div>
</template>
