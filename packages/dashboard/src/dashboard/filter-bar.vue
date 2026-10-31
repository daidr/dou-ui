<script setup lang="ts">
import { SearchIcon } from '@dou-ui/icons'
import { DouButton, DouDatePicker, DouInput, DouSelect, DouTag } from 'dou-ui'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { isEmptyFilter } from '../data/filters'
import type { DashboardFilterField } from '../data/types'
import { format, useDashboardMessages } from '../locale'
import type { DashboardFilterBarProps } from './types'

defineOptions({ name: 'DouDashboardFilterBar' })

const props = withDefaults(defineProps<DashboardFilterBarProps>(), {
  for: null,
  fields: () => [],
  clearable: true,
})
defineSlots<{
  /** More controls at the end of the bar, e.g. a refresh button. */
  default?: () => unknown
}>()

const messages = useDashboardMessages(() => props.messages)
const id = useId()
const dashboard = computed(() => props.for)
const values = computed(() => dashboard.value?.filters ?? {})
const fieldKeys = computed(() => new Set(props.fields.map((field) => field.key)))
/** Filters set by widgets that no field shows. */
const linked = computed(() =>
  (dashboard.value?.linkedFilters ?? []).filter((link) => !fieldKeys.value.has(link.key)),
)
const titleOf = (widgetId: string) => {
  const widget = dashboard.value?.document.widgets.find((item) => item.id === widgetId)
  const type = widget && dashboard.value?.types.find((item) => item.type === widget.type)
  return widget?.title || type?.label || widgetId
}
const anySet = computed(() => Object.values(values.value).some((value) => !isEmptyFilter(value)))

const set = (key: string, value: unknown) => dashboard.value?.setFilter(key, value)

// search fields apply once typing pauses
const typed = ref<Record<string, string>>({})
const timers = new Map<string, ReturnType<typeof setTimeout>>()
watch(
  values,
  (next) => {
    for (const field of props.fields)
      if (field.type === 'search' && !timers.has(field.key))
        typed.value[field.key] =
          typeof next[field.key] === 'string' ? (next[field.key] as string) : ''
  },
  { immediate: true },
)
function onType(field: DashboardFilterField, text: string) {
  typed.value[field.key] = text
  clearTimeout(timers.get(field.key))
  timers.set(
    field.key,
    setTimeout(() => {
      timers.delete(field.key)
      set(field.key, text.trim())
    }, 300),
  )
}
onBeforeUnmount(() => timers.forEach((timer) => clearTimeout(timer)))
</script>

<template>
  <div class="dou-dashboard-filter" role="group" :aria-label="messages.filterBar">
    <div
      v-for="field in fields"
      :key="field.key"
      class="dou-dashboard-filter__field"
      role="group"
      :aria-labelledby="`${id}-${field.key}`"
    >
      <span :id="`${id}-${field.key}`" class="dou-dashboard-filter__label">{{ field.label }}</span>
      <DouSelect
        v-if="field.type === 'select'"
        class="dou-dashboard-filter__control"
        size="sm"
        :model-value="(values[field.key] as any) ?? (field.multiple ? [] : null)"
        :options="field.options"
        :multiple="field.multiple"
        :max-tag-count="field.multiple ? 1 : undefined"
        :placeholder="field.placeholder"
        :aria-label="field.label"
        clearable
        @update:model-value="(value) => set(field.key, value)"
      />
      <DouDatePicker
        v-else-if="field.type === 'date-range'"
        class="dou-dashboard-filter__control is-range"
        size="sm"
        range
        clearable
        :model-value="(values[field.key] as any) ?? null"
        @update:model-value="(value) => set(field.key, value)"
      />
      <DouInput
        v-else
        class="dou-dashboard-filter__control"
        size="sm"
        clearable
        :model-value="typed[field.key] ?? ''"
        :placeholder="field.placeholder"
        :aria-label="field.label"
        @update:model-value="(value) => onType(field, value)"
      >
        <template #prefix><SearchIcon /></template>
      </DouInput>
    </div>
    <DouTag
      v-for="link in linked"
      :key="link.key"
      class="dou-dashboard-filter__link"
      closable
      :close-label="format(messages.clearFilter, { value: link.label })"
      @close="set(link.key, undefined)"
    >
      {{ format(messages.linkedFilter, { title: titleOf(link.widget), value: link.label }) }}
    </DouTag>
    <DouButton
      v-if="clearable && anySet"
      class="dou-dashboard-filter__clear"
      size="sm"
      variant="ghost"
      @click="dashboard?.clearFilters()"
    >
      {{ messages.clearFilters }}
    </DouButton>
    <div v-if="$slots.default" class="dou-dashboard-filter__extra"><slot /></div>
  </div>
</template>
