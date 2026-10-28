<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { formatNumber } from './format'
import type { StatisticProps, StatisticSlots } from './statistic'

defineOptions({ name: 'DouStatistic' })

const props = withDefaults(defineProps<StatisticProps>(), {
  groupSeparator: ',',
  decimalSeparator: '.',
  upIsGood: true,
  loading: false,
})
const slots = defineSlots<StatisticSlots>()

const ns = useNamespace('statistic')
const { t } = useLocale()

const parts = computed(() => {
  const { value } = props
  if (value === null || value === undefined || value === '') return { text: '—' }
  if (typeof value === 'string') return { text: value }
  if (props.formatter) return { text: props.formatter(value) }
  return formatNumber(value, props)
})

const good = computed(() => {
  if (!props.trend) return undefined
  return (props.trend === 'up') === props.upIsGood
})
</script>

<template>
  <div
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
        <svg
          v-if="trend"
          :class="[ns.e('trend'), ns.is(trend, true)]"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          role="img"
          :aria-label="t(trend === 'up' ? 'statistic.up' : 'statistic.down')"
        >
          <path v-if="trend === 'up'" d="M8 13V3.5M4 7.5l4-4 4 4" />
          <path v-else d="M8 3v9.5M4 8.5l4 4 4-4" />
        </svg>
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
