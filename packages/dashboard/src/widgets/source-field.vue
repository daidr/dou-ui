<script setup lang="ts">
import { DouSelect } from 'dou-ui'
import { computed } from 'vue'
import { useDashboardMessages } from '../locale'
import { useDashboardWidget } from '../widget/context'
import SettingsField from './settings-field.vue'

defineOptions({ name: 'DouDashboardSourceField' })

/** The source's name in the widget's `props.source`. */
const model = defineModel<string | undefined>()
const props = defineProps<{ optional?: boolean }>()

const messages = useDashboardMessages()
const { sources } = useDashboardWidget()
const options = computed(() => [
  ...(props.optional ? [{ value: '', label: messages.value.noSource }] : []),
  ...sources.value.map((name) => ({ value: name, label: name })),
])
</script>

<template>
  <SettingsField :label="messages.source">
    <DouSelect
      :model-value="model ?? ''"
      :options="options"
      :aria-label="messages.source"
      @update:model-value="(value) => (model = (value as string) || undefined)"
    />
  </SettingsField>
</template>
