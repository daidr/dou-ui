<script setup lang="ts">
import { GlobeIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouPopover } from '../popover'
import { sourceSite } from './chat-sources'
import type { ChatCitationProps } from './chat-sources'

defineOptions({ name: 'DouChatCitation' })

const props = defineProps<ChatCitationProps>()

const ns = useNamespace('chat-citation')
const { t } = useLocale()
const site = computed(() => (props.source ? sourceSite(props.source) : ''))
const label = computed(() =>
  props.source
    ? t('chat.citation', { index: props.index, title: props.source.title })
    : String(props.index),
)
</script>

<template>
  <DouPopover
    v-if="source"
    trigger="hover"
    placement="top"
    :width="300"
    :show-delay="150"
    :class="ns.e('popover')"
  >
    <component
      :is="source.url ? 'a' : 'span'"
      :class="ns.b()"
      :href="source.url"
      :target="source.url ? '_blank' : undefined"
      :rel="source.url ? 'noopener noreferrer' : undefined"
      :tabindex="source.url ? undefined : 0"
      :aria-label="label"
      >{{ index }}</component
    >
    <template #content>
      <span :class="ns.e('site')">
        <img v-if="source.icon" :class="ns.e('favicon')" :src="source.icon" alt="" />
        <GlobeIcon v-else :class="ns.e('favicon')" />
        {{ site }}
      </span>
      <span :class="ns.e('title')">{{ source.title }}</span>
      <span v-if="source.description" :class="ns.e('description')">{{ source.description }}</span>
    </template>
  </DouPopover>
  <span v-else :class="ns.b()">{{ index }}</span>
</template>
