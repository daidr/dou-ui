<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouAvatar } from '../avatar'
import { useLocale } from '../config-provider/use-config'
import type { ChatBubbleProps, ChatBubbleSlots } from './chat-bubble'

defineOptions({ name: 'DouChatBubble' })

const props = withDefaults(defineProps<ChatBubbleProps>(), {
  placement: 'start',
  variant: 'soft',
  avatar: undefined,
  loading: false,
})
const slots = defineSlots<ChatBubbleSlots>()

const ns = useNamespace('chat-bubble')
const { t } = useLocale()

// `avatar` written bare in a template arrives as an empty string
const showAvatar = computed(() => props.avatar !== undefined && props.avatar !== false)
const hasAvatar = computed(
  () => props.placement !== 'center' && (showAvatar.value || !!slots.avatar),
)
const hasHeader = computed(() => !!slots.header || !!props.name || !!props.time)
</script>

<template>
  <div
    :class="[
      ns.b(),
      ns.m(placement),
      ns.m(variant),
      ns.is('loading', loading),
      ns.is('with-avatar', hasAvatar),
    ]"
  >
    <div v-if="hasAvatar" :class="ns.e('avatar')">
      <slot name="avatar"
        ><DouAvatar :src="typeof avatar === 'string' && avatar ? avatar : undefined" :name="name"
      /></slot>
    </div>
    <div :class="ns.e('body')">
      <div v-if="hasHeader" :class="ns.e('header')">
        <slot name="header">
          <span v-if="name" :class="ns.e('name')">{{ name }}</span>
          <time v-if="time" :class="ns.e('time')">{{ time }}</time>
        </slot>
      </div>
      <div :class="ns.e('content')">
        <span v-if="loading" :class="ns.e('dots')" role="status" :aria-label="t('chat.loading')">
          <i /><i /><i />
        </span>
        <slot v-else
          ><span :class="ns.e('text')">{{ content }}</span></slot
        >
      </div>
      <div v-if="slots.footer && !loading" :class="ns.e('footer')"><slot name="footer" /></div>
    </div>
  </div>
</template>
