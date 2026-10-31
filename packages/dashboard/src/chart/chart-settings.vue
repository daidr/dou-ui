<script setup lang="ts">
import { DouInput, DouSegmentedControl, DouSwitch } from 'dou-ui'
import { computed } from 'vue'
import { useDashboardMessages } from '../locale'
import { useDashboardWidget } from '../widget/context'
import FieldSelect from '../widgets/field-select.vue'
import SettingsField from '../widgets/settings-field.vue'
import { fieldsOf, numberFieldsOf, rowsOf } from '../widgets/shared'
import SourceField from '../widgets/source-field.vue'
import type { ChartWidgetProps } from './types'

defineOptions({ name: 'DouDashboardChartSettings' })

const model = defineModel<ChartWidgetProps>({ required: true })
const messages = useDashboardMessages()
const { data } = useDashboardWidget()
const rows = computed(() => rowsOf(data.value, model.value.path))
const set = (patch: Partial<ChartWidgetProps>) => (model.value = { ...model.value, ...patch })
const kind = computed(() => model.value.kind ?? 'line')
</script>

<template>
  <div class="dou-dashboard__settings">
    <SourceField :model-value="model.source" @update:model-value="(source) => set({ source })" />
    <SettingsField :label="messages.chartKind">
      <DouSegmentedControl
        :model-value="kind"
        :options="[
          { value: 'line', label: messages.chartLine },
          { value: 'area', label: messages.chartArea },
          { value: 'bar', label: messages.chartBar },
          { value: 'pie', label: messages.chartPie },
        ]"
        :aria-label="messages.chartKind"
        @update:model-value="(value) => set({ kind: value as ChartWidgetProps['kind'] })"
      />
    </SettingsField>
    <FieldSelect
      :model-value="model.x"
      :label="messages.xField"
      :fields="fieldsOf(rows)"
      @update:model-value="(x) => set({ x: x as string | undefined })"
    />
    <FieldSelect
      :model-value="kind === 'pie' ? (model.y ?? []).slice(0, 1) : model.y"
      :label="messages.yFields"
      :fields="numberFieldsOf(rows)"
      :multiple="kind !== 'pie'"
      @update:model-value="
        (y) => set({ y: y === undefined ? undefined : Array.isArray(y) ? y : [y] })
      "
    />
    <div v-if="kind === 'bar' || kind === 'area'" class="dou-dashboard__field-row">
      <DouSwitch
        :model-value="!!model.stacked"
        @update:model-value="(stacked) => set({ stacked: stacked || undefined })"
      >
        {{ messages.stacked }}
      </DouSwitch>
      <DouSwitch
        v-if="kind === 'bar'"
        :model-value="!!model.horizontal"
        @update:model-value="(horizontal) => set({ horizontal: horizontal || undefined })"
      >
        {{ messages.horizontal }}
      </DouSwitch>
    </div>
    <SettingsField :label="messages.filterKey" :hint="messages.filterKeyHint">
      <DouInput
        :model-value="model.filterKey ?? ''"
        :aria-label="messages.filterKey"
        @update:model-value="(key) => set({ filterKey: key.trim() || undefined })"
      />
    </SettingsField>
  </div>
</template>
