<script setup lang="ts">
import { DouSelect } from 'dou-ui'
import { computed } from 'vue'
import SettingsField from './settings-field.vue'

defineOptions({ name: 'DouDashboardFieldSelect' })

const model = defineModel<string | string[] | undefined>()
const props = defineProps<{
  label: string
  hint?: string
  /** The fields of the data; a value not among them stays selectable. */
  fields: string[]
  multiple?: boolean
}>()

const options = computed(() => {
  const list = [...props.fields]
  const current = Array.isArray(model.value) ? model.value : model.value ? [model.value] : []
  for (const field of current) if (!list.includes(field)) list.push(field)
  return list
})
</script>

<template>
  <SettingsField :label="label" :hint="hint">
    <DouSelect
      :model-value="model ?? (multiple ? [] : null)"
      :options="options"
      :multiple="multiple"
      :aria-label="label"
      filterable
      creatable
      clearable
      @update:model-value="(value) => (model = (value as any) ?? undefined)"
    />
  </SettingsField>
</template>
