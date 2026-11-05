<script setup lang="ts">
import { DouCheckbox, DouInput } from 'dou-ui'
import { computed } from 'vue'
import { format, useDashboardMessages } from '../locale'
import { useDashboardWidget } from '../widget/context'
import SettingsField from './settings-field.vue'
import { fieldsOf, rowsOf } from './shared'
import SourceField from './source-field.vue'
import type { TableWidgetColumn, TableWidgetProps } from './types'
import { tablePropsOf } from './read-props'

defineOptions({ name: 'DouDashboardTableSettings' })

const model = defineModel<TableWidgetProps>({ required: true })
// the props as saved may have the wrong types: read them as the widget does
const view = computed(() => tablePropsOf(model.value as Record<string, unknown>))
const messages = useDashboardMessages()
const { data } = useDashboardWidget()

/** Every field of the rows, those shown first in their order. */
const fields = computed(() => {
  const all = fieldsOf(rowsOf(data.value, view.value.path))
  const shown = view.value.columns?.map((column) => column.key) ?? all
  return [...shown, ...all.filter((key) => !shown.includes(key))]
})
const columns = computed<TableWidgetColumn[]>(
  () => view.value.columns ?? fieldsOf(rowsOf(data.value, view.value.path)).map((key) => ({ key })),
)
const columnOf = (key: string) => columns.value.find((column) => column.key === key)

function toggle(key: string, on: boolean) {
  const next = on
    ? [...columns.value, { key }]
    : columns.value.filter((column) => column.key !== key)
  model.value = { ...model.value, columns: next }
}

function retitle(key: string, title: string) {
  const next = columns.value.map((column) =>
    column.key === key ? { key, ...(title ? { title } : {}) } : column,
  )
  model.value = { ...model.value, columns: next }
}
</script>

<template>
  <div class="dou-dashboard__settings">
    <SourceField
      :model-value="view.source"
      @update:model-value="(source) => (model = { ...model, source })"
    />
    <SettingsField v-if="fields.length" :label="messages.columns">
      <div class="dou-dashboard__columns">
        <div v-for="key in fields" :key="key" class="dou-dashboard__column">
          <DouCheckbox
            :model-value="!!columnOf(key)"
            @update:model-value="(on) => toggle(key, !!on)"
          >
            {{ key }}
          </DouCheckbox>
          <DouInput
            v-if="columnOf(key)"
            size="sm"
            :model-value="columnOf(key)?.title ?? ''"
            :placeholder="key"
            :aria-label="format(messages.columnTitle, { field: key })"
            @update:model-value="(title) => retitle(key, title)"
          />
        </div>
      </div>
    </SettingsField>
  </div>
</template>
