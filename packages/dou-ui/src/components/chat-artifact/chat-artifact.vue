<script setup lang="ts">
import {
  AlertCircleIcon,
  ChevronRightIcon,
  CodeIcon,
  FileIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  TableIcon,
} from '@dou-ui/icons'
import type { Component } from 'vue'
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useStatusCheck } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import { DouShimmer } from '../shimmer'
import type {
  ChatArtifactEmits,
  ChatArtifactKind,
  ChatArtifactProps,
  ChatArtifactSlots,
} from './chat-artifact'

defineOptions({ name: 'DouChatArtifact' })

const props = withDefaults(defineProps<ChatArtifactProps>(), {
  kind: 'document',
  status: 'done',
  active: false,
})
const emit = defineEmits<ChatArtifactEmits>()
const slots = defineSlots<ChatArtifactSlots>()

const ns = useNamespace('chat-artifact')
const { t } = useLocale()

useStatusCheck('DouChatArtifact', () => [props.status], ['running', 'done', 'error'], {
  generating: 'running',
})

const icons: Record<ChatArtifactKind, Component> = {
  document: FileTextIcon,
  code: CodeIcon,
  image: ImageIcon,
  web: GlobeIcon,
  data: TableIcon,
  file: FileIcon,
}
const Icon = computed(() => icons[props.kind])
</script>

<template>
  <div :class="[ns.b(), ns.is(status), ns.is('active', active)]">
    <button
      type="button"
      :class="ns.e('main')"
      :aria-current="active || undefined"
      @click="emit('open', $event)"
    >
      <span :class="ns.e('icon')" aria-hidden="true">
        <slot name="icon"><component :is="Icon" /></slot>
      </span>
      <span :class="ns.e('text')">
        <span :class="ns.e('title')">{{ title }}</span>
        <span :class="ns.e('description')">
          <DouShimmer v-if="status === 'running'">{{ t('chat.generating') }}</DouShimmer>
          <template v-else-if="status === 'error'">
            <AlertCircleIcon aria-hidden="true" />{{ t('chat.generateError') }}
          </template>
          <template v-else>{{ description }}</template>
        </span>
      </span>
      <ChevronRightIcon v-if="!slots.actions" :class="ns.e('arrow')" />
    </button>
    <div v-if="slots.actions" :class="ns.e('actions')"><slot name="actions" /></div>
  </div>
</template>
