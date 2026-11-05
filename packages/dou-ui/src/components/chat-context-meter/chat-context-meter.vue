<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { devWarn } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import { compactNumber, contextUsage } from './chat-context-meter'
import type { ChatContextMeterProps } from './chat-context-meter'

defineOptions({ name: 'DouChatContextMeter' })

const props = withDefaults(defineProps<ChatContextMeterProps>(), {
  used: 0,
  total: 0,
  warnAt: 0.8,
  dangerAt: 0.95,
  showLabel: false,
})

const ns = useNamespace('chat-context-meter')
const { t } = useLocale()

const usage = computed(() => contextUsage(props.used, props.total))
const share = computed(() => usage.value.share)
const percent = computed(() => usage.value.percent)
const tone = computed(() =>
  share.value >= props.dangerAt ? 'danger' : share.value >= props.warnAt ? 'warning' : 'neutral',
)
// what a screen reader hears for the value; the ring shows no numbers
const valueText = computed(() =>
  t('chat.context', {
    used: compactNumber(usage.value.used),
    total: compactNumber(usage.value.total),
    percent: percent.value,
  }),
)

// an icon-only button sizes the ring as its icon: the label would spill out of it
const root = useTemplateRef<HTMLElement>('root')
onMounted(() => {
  if (process.env.NODE_ENV === 'production' || !props.showLabel) return
  if (root.value?.parentElement?.closest('.dou-button.is-icon-only'))
    devWarn(
      '[dou-ui] DouChatContextMeter: `showLabel` inside an icon-only button spills out of it, as the button sizes the ring as its icon. Put the ring in the button’s `leading` slot and the percentage as its text.',
    )
})

// r = 6 on a 16 box; the circumference drives the dash
const CIRCUMFERENCE = 2 * Math.PI * 6
</script>

<template>
  <!-- only the ring: a tooltip or popover goes around it, so it takes no focus of its own; an `aria-label` passed in replaces the default name -->
  <span
    ref="root"
    :class="[ns.b(), ns.m(tone)]"
    role="meter"
    :aria-label="t('chat.contextLabel')"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuetext="valueText"
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
</template>
