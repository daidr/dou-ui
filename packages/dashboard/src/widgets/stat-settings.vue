<script setup lang="ts">
import { DouInput, DouInputNumber } from 'dou-ui'
import { computed } from 'vue'
import { useDashboardMessages } from '../locale'
import { useDashboardWidget } from '../widget/context'
import FieldSelect from './field-select.vue'
import SettingsField from './settings-field.vue'
import { fieldsOf } from './shared'
import SourceField from './source-field.vue'
import type { StatWidgetProps } from './types'
import { statPropsOf } from './read-props'

defineOptions({ name: 'DouDashboardStatSettings' })

const model = defineModel<StatWidgetProps>({ required: true })
// the props as saved may have the wrong types: read them as the widget does
const view = computed(() => statPropsOf(model.value as Record<string, unknown>))
const messages = useDashboardMessages()
const { data } = useDashboardWidget()
const fields = computed(() => fieldsOf(data.value))
const set = (patch: Partial<StatWidgetProps>) => (model.value = { ...model.value, ...patch })
</script>

<template>
  <div class="dou-dashboard__settings">
    <SourceField
      :model-value="view.source"
      optional
      @update:model-value="(source) => set({ source })"
    />
    <FieldSelect
      v-if="view.source"
      :model-value="view.field"
      :label="messages.value"
      :fields="fields"
      @update:model-value="(field) => set({ field: field as string | undefined })"
    />
    <SettingsField v-else :label="messages.value">
      <DouInputNumber
        :model-value="view.value ?? null"
        :aria-label="messages.value"
        @update:model-value="(value) => set({ value: value ?? undefined })"
      />
    </SettingsField>
    <div class="dou-dashboard__field-row">
      <SettingsField :label="messages.prefix">
        <DouInput
          :model-value="view.prefix ?? ''"
          :aria-label="messages.prefix"
          @update:model-value="(prefix) => set({ prefix: prefix || undefined })"
        />
      </SettingsField>
      <SettingsField :label="messages.suffix">
        <DouInput
          :model-value="view.suffix ?? ''"
          :aria-label="messages.suffix"
          @update:model-value="(suffix) => set({ suffix: suffix || undefined })"
        />
      </SettingsField>
    </div>
    <SettingsField :label="messages.precision">
      <DouInputNumber
        :model-value="view.precision ?? null"
        :min="0"
        :max="6"
        :aria-label="messages.precision"
        @update:model-value="(precision) => set({ precision: precision ?? undefined })"
      />
    </SettingsField>
    <template v-if="view.source">
      <FieldSelect
        :model-value="view.trend"
        :label="messages.trend"
        :fields="fields"
        @update:model-value="(trend) => set({ trend: trend as string | undefined })"
      />
      <FieldSelect
        :model-value="view.delta"
        :label="messages.delta"
        :fields="fields"
        @update:model-value="(delta) => set({ delta: delta as string | undefined })"
      />
    </template>
  </div>
</template>
