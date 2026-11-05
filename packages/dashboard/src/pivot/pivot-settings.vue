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
import { pivotPropsOf } from './read-props'

defineOptions({ name: 'DouDashboardPivotSettings' })

defineProps<{ fields?: readonly PivotField[] }>()
const model = defineModel<PivotWidgetProps>({ required: true })
// the props as saved may have the wrong types: read them as the widget does
const view = computed(() => pivotPropsOf(model.value as Record<string, unknown>))
const messages = useDashboardMessages()
const { data } = useDashboardWidget()
const rows = computed(() => rowsOf(data.value, view.value.path))
const set = (patch: Partial<PivotWidgetProps>) => (model.value = { ...model.value, ...patch })
</script>

<template>
  <div class="dou-dashboard__settings">
    <SourceField :model-value="view.source" @update:model-value="(source) => set({ source })" />
    <SettingsField v-if="rows.length" :label="messages.field">
      <DouPivotFields
        :data="rows"
        :fields="fields"
        :config="view.config"
        :drawer="false"
        @update:config="(config) => set({ config })"
      />
    </SettingsField>
    <DouSwitch
      :model-value="!!view.filter"
      @update:model-value="(filter) => set({ filter: filter || undefined })"
    >
      {{ messages.pivotFilter }}
    </DouSwitch>
  </div>
</template>
