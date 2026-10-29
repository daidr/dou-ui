<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '../../composables/use-now'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { formatMoment, nextChange, relativeFormatter, relativeUnit, toTime } from './format'
import type { RelativeTimeProps } from './relative-time'

defineOptions({ name: 'DouRelativeTime' })

const props = withDefaults(defineProps<RelativeTimeProps>(), { numeric: 'auto' })

const ns = useNamespace('relative-time')
const { locale, t } = useLocale()

const time = computed(() => toTime(props.value))
// the clock only ticks when no fixed `now` is given, and only as often as the text can change
const clock = useNow({
  interval: () => (props.now === undefined ? nextChange(time.value - Date.now()) : 3_600_000),
})
const now = computed(() => (props.now === undefined ? clock.value : toTime(props.now)))
const diff = computed(() => time.value - now.value)

const meridiem = computed(() => ({ am: t('inputDate.am'), pm: t('inputDate.pm') }))

const text = computed(() => {
  if (Number.isNaN(time.value)) return ''
  if (props.absoluteAfter !== undefined && Math.abs(diff.value) > props.absoluteAfter)
    return formatMoment(time.value, props.format ?? t('region.date'), meridiem.value)
  const part = relativeUnit(diff.value)
  if (!part) return t('relativeTime.justNow')
  return relativeFormatter(locale.value.name, props.numeric, props.short).format(
    part.count,
    part.unit,
  )
})

const datetime = computed(() =>
  Number.isNaN(time.value) ? undefined : new Date(time.value).toISOString(),
)
const full = computed(() =>
  Number.isNaN(time.value)
    ? undefined
    : formatMoment(time.value, `${t('region.date')} ${t('region.time')}`, meridiem.value),
)
</script>

<template>
  <time :class="ns.b()" :datetime="datetime" :title="full">{{ text }}</time>
</template>
