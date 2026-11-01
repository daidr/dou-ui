<script setup lang="ts">
import { computed, h, reactive, ref, shallowRef } from 'vue'
import { numberFormatFull } from '../core/format'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartGaugeProps, ChartGaugeSlots } from '../types'

defineOptions({ name: 'DouChartGauge', render: renderNothing })

const props = withDefaults(defineProps<ChartGaugeProps>(), {
  min: 0,
  max: 100,
  innerRadius: 0.8,
  startAngle: -120,
  endAngle: 120,
})
const slots = defineSlots<ChartGaugeSlots>()

/** The value within the track: past its ends, the arc stops there. */
const clamped = computed(() => {
  const lo = Math.min(props.min, props.max)
  const hi = Math.max(props.min, props.max)
  return Number.isFinite(props.value) ? Math.min(hi, Math.max(lo, props.value)) : lo
})
/** The chart's locale, once the gauge is in one. */
const localeOf = shallowRef<() => string>(() => 'zh-CN')
const text = computed(() =>
  props.format ? props.format(props.value) : numberFormatFull(localeOf.value())(props.value),
)

// a pie of two slices: the value from the start of the track, and the rest of it
const rows = computed(() => {
  const color = typeof props.color === 'function' ? props.color(props.value) : props.color
  return [
    { label: props.name ?? '', part: Math.abs(clamped.value - props.min), color },
    { label: '', part: Math.abs(props.max - clamped.value), color: 'var(--dou-chart-track)' },
  ]
})

const shown = reactive({
  data: rows,
  value: 'part',
  label: 'label',
  color: (row: { color?: string }) => row.color as string,
  name: computed(() => props.name),
  innerRadius: computed(() => props.innerRadius),
  startAngle: computed(() => props.startAngle),
  endAngle: computed(() => props.endAngle),
})

const el = useOwnNode()
useChartPart('DouChartGauge', (chart) => {
  localeOf.value = chart.locale
  return chart.addPie({
    props: shown as never,
    el,
    hidden: ref([]),
    gauge: () => ({ value: props.value, min: props.min, max: props.max, text: text.value }),
    center: () =>
      slots.default?.({ value: props.value, text: text.value }) ?? [
        h('div', { class: 'dou-chart__gauge-value' }, text.value),
        props.name ? h('div', { class: 'dou-chart__gauge-name' }, props.name) : null,
      ],
  })
})
</script>
