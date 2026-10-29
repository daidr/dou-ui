<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { ArrowDownIcon, ArrowUpIcon } from '@dou-ui/icons'
import { getMotionDuration, useReducedMotion } from '../../composables/use-motion'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { formatNumber } from './format'
import type { StatisticProps, StatisticSlots } from './statistic'

defineOptions({ name: 'DouStatistic' })

const props = withDefaults(defineProps<StatisticProps>(), {
  upIsGood: true,
  loading: false,
  animated: false,
})
const slots = defineSlots<StatisticSlots>()

const ns = useNamespace('statistic')
const { t, locale } = useLocale()

/* counting from the old value to the new one */

const rootRef = useTemplateRef<HTMLElement>('root')
const reducedMotion = useReducedMotion()
/** The number on its way to `value`, while counting. */
const counting = ref<number>()
let frame = 0

const decimalsOf = (value: number) => (String(value).split('.')[1] ?? '').length
const roundTo = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals

function stop() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  counting.value = undefined
}

watch(
  () => props.value,
  (to, from) => {
    const start = counting.value ?? from
    stop()
    if (
      !props.animated ||
      reducedMotion.value ||
      typeof to !== 'number' ||
      typeof start !== 'number' ||
      to === start ||
      typeof requestAnimationFrame === 'undefined'
    )
      return
    const duration = getMotionDuration('slow', rootRef.value ?? undefined)
    if (!duration) return
    const decimals = props.precision ?? decimalsOf(to)
    const began = performance.now()
    counting.value = start
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / duration)
      if (progress >= 1) return stop()
      const eased = 1 - (1 - progress) ** 3
      counting.value = roundTo(start + (to - start) * eased, decimals)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  },
)
onBeforeUnmount(stop)

const parts = computed(() => {
  const value = counting.value ?? props.value
  if (value === null || value === undefined || value === '') return { text: '—' }
  if (typeof value === 'string') return { text: value }
  if (props.formatter) return { text: props.formatter(value) }
  // while counting, keep as many decimals as the target so the width holds
  const target = props.value
  return formatNumber(value, {
    precision:
      props.precision ??
      (counting.value !== undefined && typeof target === 'number' ? decimalsOf(target) : undefined),
    groupSeparator: props.groupSeparator ?? locale.value.region.groupSeparator,
    decimalSeparator: props.decimalSeparator ?? locale.value.region.decimalSeparator,
  })
})

const good = computed(() => {
  if (!props.trend) return undefined
  return (props.trend === 'up') === props.upIsGood
})
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.is('good', good === true),
      ns.is('bad', good === false),
      ns.is('loading', loading),
    ]"
  >
    <div v-if="slots.title || title" :class="ns.e('title')">
      <slot name="title">{{ title }}</slot>
    </div>
    <div :class="ns.e('content')" :aria-busy="loading || undefined">
      <span v-if="loading" :class="ns.e('placeholder')" />
      <template v-else>
        <component
          :is="trend === 'up' ? ArrowUpIcon : ArrowDownIcon"
          v-if="trend"
          :class="[ns.e('trend'), ns.is(trend, true)]"
          :label="t(trend === 'up' ? 'statistic.up' : 'statistic.down')"
        />
        <span v-if="slots.prefix || prefix" :class="ns.e('prefix')">
          <slot name="prefix">{{ prefix }}</slot>
        </span>
        <span :class="ns.e('value')">
          <template v-if="'text' in parts">{{ parts.text }}</template>
          <template v-else>
            {{ parts.sign }}{{ parts.integer
            }}<span v-if="parts.decimal" :class="ns.e('decimal')">{{ parts.decimal }}</span>
          </template>
        </span>
        <span v-if="slots.suffix || suffix" :class="ns.e('suffix')">
          <slot name="suffix">{{ suffix }}</slot>
        </span>
      </template>
    </div>
    <div v-if="slots.footer" :class="ns.e('footer')">
      <slot name="footer" />
    </div>
  </div>
</template>
