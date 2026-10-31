<script setup lang="ts">
import { ref } from 'vue'
import type { DashboardWidget } from '../core/types'
import { provideWidgetContext } from '../widget/context'
import type { DashboardWidgetType } from '../widget/define'

defineOptions({ name: 'DouDashboardWidgetSettings' })

const props = defineProps<{
  widget: DashboardWidget
  type: DashboardWidgetType<any>
  setProps: (id: string, patch: Record<string, unknown>, options?: { group?: string }) => void
}>()
const emit = defineEmits<{ 'update:props': [props: Record<string, unknown>] }>()

// the settings form can read the widget the same way its content does
provideWidgetContext({
  widget: () => props.widget,
  editing: () => true,
  fullscreen: () => false,
  size: { width: ref(0), height: ref(0) },
  setProps: props.setProps,
})
</script>

<template>
  <component
    :is="type.settings"
    :model-value="widget.props ?? {}"
    @update:model-value="(value: Record<string, unknown>) => emit('update:props', value)"
  />
</template>
