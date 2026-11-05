<script setup lang="ts">
import { AlertCircleIcon } from '@dou-ui/icons'
import { DouButton } from 'dou-ui'
import { ref, watch } from 'vue'
import type { DashboardWidget } from '../core/types'
import type { DashboardMessages } from '../locale'
import { provideWidgetContext } from '../widget/context'
import type { DashboardWidgetType } from '../widget/define'
import { useErrorBoundary } from './error-boundary'

defineOptions({ name: 'DouDashboardWidgetSettings' })

const props = defineProps<{
  widget: DashboardWidget
  type: DashboardWidgetType<any>
  messages: DashboardMessages
  setProps: (id: string, patch: Record<string, unknown>, options?: { group?: string }) => void
  /** Told when the settings form breaks, for the dashboard's `widgetError`. */
  reportError?: (id: string, error: unknown) => void
}>()
const emit = defineEmits<{ 'update:props': [props: Record<string, unknown>] }>()

// the settings form can read the widget the same way its content does
const { data } = provideWidgetContext({
  widget: () => props.widget,
  editing: () => true,
  fullscreen: () => false,
  size: { width: ref(0), height: ref(0) },
  setProps: props.setProps,
})

// a settings form that breaks shows an error in the drawer, not to the app;
// the title field above it still works
const failed = useErrorBoundary(
  () => `settings of widget "${props.widget.id}" (${props.widget.type})`,
  (error) => props.reportError?.(props.widget.id, error),
)
const retry = () => (failed.value = false)
watch(() => props.widget.props, retry, { deep: true })
watch(data, retry)
</script>

<template>
  <div v-if="failed" class="dou-dashboard__settings-error" role="alert">
    <AlertCircleIcon class="dou-dashboard__status-icon" />
    <span>{{ messages.settingsError }}</span>
    <DouButton size="sm" variant="soft" @click="retry">{{ messages.retry }}</DouButton>
  </div>
  <component
    :is="type.settings"
    v-else
    :model-value="widget.props ?? {}"
    @update:model-value="(value: Record<string, unknown>) => emit('update:props', value)"
  />
</template>
