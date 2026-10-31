<script setup lang="ts">
import { DouPivotFields } from '@dou-ui/pivot'
import type { PivotField } from '@dou-ui/pivot'
import { DouSwitch } from 'dou-ui'
import { computed } from 'vue'
import { useDashboardMessages } from '../locale'
import { useDashboardWidget } from '../widget/context'
import SettingsField from '../widgets/settings-field.vue'
import { rowsOf } from '../widgets/shared'
import SourceField from '../widgets/source-field.vue'
import type { PivotWidgetProps } from './types'

defineOptions({ name: 'DouDashboardPivotSettings' })

defineProps<{ fields?: readonly PivotField[] }>()
const model = defineModel<PivotWidgetProps>({ required: true })
const messages = useDashboardMessages()
const { data } = useDashboardWidget()
const rows = computed(() => rowsOf(data.value, model.value.path))
const set = (patch: Partial<PivotWidgetProps>) => (model.value = { ...model.value, ...patch })
</script>

<template>
  <div class="dou-dashboard__settings">
    <SourceField :model-value="model.source" @update:model-value="(source) => set({ source })" />
    <SettingsField v-if="rows.length" :label="messages.field">
      <DouPivotFields
        :data="rows"
        :fields="fields"
        :config="model.config"
        :drawer="false"
        @update:config="(config) => set({ config })"
      />
    </SettingsField>
    <DouSwitch
      :model-value="!!model.filter"
      @update:model-value="(filter) => set({ filter: filter || undefined })"
    >
      {{ messages.pivotFilter }}
    </DouSwitch>
  </div>
</template>
