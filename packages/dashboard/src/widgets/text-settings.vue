<script setup lang="ts">
import { computed } from 'vue'
import { DouSegmentedControl, DouTextarea } from 'dou-ui'
import { useDashboardMessages } from '../locale'
import SettingsField from './settings-field.vue'
import type { TextWidgetProps } from './types'
import { textPropsOf } from './read-props'

defineOptions({ name: 'DouDashboardTextSettings' })

const model = defineModel<TextWidgetProps>({ required: true })
// the props as saved may have the wrong types: read them as the widget does
const view = computed(() => textPropsOf(model.value as Record<string, unknown>))
const messages = useDashboardMessages()
const set = (patch: Partial<TextWidgetProps>) => (model.value = { ...model.value, ...patch })
</script>

<template>
  <div class="dou-dashboard__settings">
    <SettingsField :label="messages.text">
      <DouTextarea
        :model-value="view.text ?? ''"
        autosize
        :rows="4"
        :aria-label="messages.text"
        @update:model-value="(text) => set({ text })"
      />
    </SettingsField>
    <SettingsField :label="messages.textSize">
      <DouSegmentedControl
        :model-value="view.size ?? 'md'"
        :options="[
          { value: 'sm', label: messages.sizeSmall },
          { value: 'md', label: messages.sizeMedium },
          { value: 'lg', label: messages.sizeLarge },
        ]"
        :aria-label="messages.textSize"
        @update:model-value="(size) => set({ size: size as TextWidgetProps['size'] })"
      />
    </SettingsField>
  </div>
</template>
