<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import DouTooltip from '../tooltip/tooltip.vue'
import { compactNumber } from './chat-context-meter'
import type { ChatContextMeterProps } from './chat-context-meter'

defineOptions({ name: 'DouChatContextMeter', inheritAttrs: false })

const props = withDefaults(defineProps<ChatContextMeterProps>(), {
  used: 0,
  total: 0,
  warnAt: 0.8,
  dangerAt: 0.95,
  showLabel: false,
})

const ns = useNamespace('chat-context-meter')
const { t } = useLocale()

const share = computed(() =>
  props.total > 0 ? Math.min(Math.max(props.used / props.total, 0), 1) : 0,
)
const percent = computed(() => Math.round(share.value * 100))
const tone = computed(() =>
  share.value >= props.dangerAt ? 'danger' : share.value >= props.warnAt ? 'warning' : 'neutral',
)
const fmt = (value: number) => (props.format ?? compactNumber)(value)
const text = computed(() =>
  t('chat.context', { used: fmt(props.used), total: fmt(props.total), percent: percent.value }),
)

// r = 6 on a 16 box; the circumference drives the dash
const CIRCUMFERENCE = 2 * Math.PI * 6
</script>

<template>
  <DouTooltip :content="text">
    <span
      v-bind="$attrs"
      :class="[ns.b(), ns.m(tone)]"
      role="meter"
      tabindex="0"
      :aria-label="t('chat.contextLabel')"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="text"
    >
      <svg :class="ns.e('ring')" viewBox="0 0 16 16" aria-hidden="true">
        <circle :class="ns.e('track')" cx="8" cy="8" r="6" />
        <circle
          :class="ns.e('bar')"
          cx="8"
          cy="8"
          r="6"
          :stroke-dasharray="`${CIRCUMFERENCE * share} ${CIRCUMFERENCE}`"
        />
      </svg>
      <span v-if="showLabel" :class="ns.e('label')">{{ percent }}%</span>
    </span>
  </DouTooltip>
</template>
