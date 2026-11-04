<script setup lang="ts">
import { ChevronDownIcon, SparklesIcon } from '@dou-ui/icons'
import { computed, ref, useId, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouCollapseTransition as CollapseTransition } from '../collapse/collapse-transition'
import { useLocale } from '../config-provider/use-config'
import { DouShimmer } from '../shimmer'
import { formatDuration } from './format'
import type { ChatReasoningEmits, ChatReasoningProps, ChatReasoningSlots } from './chat-reasoning'

defineOptions({ name: 'DouChatReasoning' })

const props = withDefaults(defineProps<ChatReasoningProps>(), {
  thinking: false,
  open: undefined,
  autoCollapse: true,
})
const emit = defineEmits<ChatReasoningEmits>()
defineSlots<ChatReasoningSlots>()

const ns = useNamespace('chat-reasoning')
const { t } = useLocale()
const id = useId()

const inner = ref(props.thinking)
const open = computed(() => props.open ?? inner.value)
function setOpen(value: boolean) {
  inner.value = value
  emit('update:open', value)
}

let startedAt = props.thinking ? Date.now() : 0
const measured = ref<number>()
watch(
  () => props.thinking,
  (thinking) => {
    if (thinking) {
      startedAt = Date.now()
      measured.value = undefined
      if (!open.value) setOpen(true)
      return
    }
    if (startedAt) measured.value = Math.round((Date.now() - startedAt) / 1000)
    startedAt = 0
    if (props.autoCollapse && open.value) setOpen(false)
  },
)

const duration = computed(() => props.duration ?? measured.value)
const label = computed(() => {
  if (props.title) return props.title
  if (props.thinking) return t('chat.thinking')
  if (duration.value === undefined) return t('chat.reasoning')
  return formatDuration(duration.value, t)
})
</script>

<template>
  <div :class="[ns.b(), ns.is('open', open), ns.is('thinking', thinking)]">
    <button
      :id="`${id}-trigger`"
      type="button"
      :class="ns.e('trigger')"
      :aria-expanded="open"
      :aria-controls="`${id}-panel`"
      @click="setOpen(!open)"
    >
      <SparklesIcon :class="ns.e('icon')" />
      <span :class="ns.e('title')">
        <slot name="title" :thinking="thinking" :duration="duration">
          <DouShimmer :active="thinking">{{ label }}</DouShimmer>
        </slot>
      </span>
      <ChevronDownIcon :class="ns.e('arrow')" />
    </button>
    <CollapseTransition>
      <div
        v-show="open"
        :id="`${id}-panel`"
        role="region"
        :class="ns.e('panel')"
        :aria-labelledby="`${id}-trigger`"
      >
        <div :class="ns.e('content')">
          <div :class="ns.e('text')"><slot /></div>
        </div>
      </div>
    </CollapseTransition>
  </div>
</template>
