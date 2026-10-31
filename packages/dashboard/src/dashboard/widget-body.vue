<script setup lang="ts">
import { AlertCircleIcon } from '@dou-ui/icons'
import { DouButton, DouEmpty, DouSpinner } from 'dou-ui'
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DashboardWidget } from '../core/types'
import type { DashboardMessages } from '../locale'
import { format } from '../locale'
import { provideWidgetContext } from '../widget/context'
import { observersKey } from './observers'
import type { DashboardWidgetType } from '../widget/define'

defineOptions({ name: 'DouDashboardWidgetBody' })

const props = defineProps<{
  widget: DashboardWidget
  type?: DashboardWidgetType<any>
  editing: boolean
  fullscreen?: boolean
  messages: DashboardMessages
  setProps: (id: string, patch: Record<string, unknown>, options?: { group?: string }) => void
}>()

const body = ref<HTMLElement>()
const width = ref(0)
const height = ref(0)
const observers = inject(observersKey)
let stop: (() => void) | undefined
onMounted(() => {
  // not read here: that would lay the page out once per widget. The first
  // observation comes before the page is painted.
  stop = observers?.size(body.value!, (entry) => {
    width.value = entry.contentRect.width
    height.value = entry.contentRect.height
  })
})
onBeforeUnmount(() => stop?.())
const { status } = provideWidgetContext({
  widget: () => props.widget,
  editing: () => props.editing,
  fullscreen: () => !!props.fullscreen,
  size: { width, height },
  setProps: props.setProps,
})
</script>

<template>
  <div class="dou-dashboard__body" :aria-busy="status.state === 'loading' || undefined">
    <div ref="body" class="dou-dashboard__content">
      <component :is="type.component" v-if="type" />
      <div v-else class="dou-dashboard__notice">
        {{ format(messages.unknownType, { type: widget.type }) }}
      </div>
    </div>
    <div v-if="status.state === 'loading'" class="dou-dashboard__status is-loading" role="status">
      <DouSpinner size="sm" :label="messages.loading" />
    </div>
    <div v-else-if="status.state === 'error'" class="dou-dashboard__status is-error" role="alert">
      <AlertCircleIcon class="dou-dashboard__status-icon" />
      <span>{{ status.message || messages.error }}</span>
      <DouButton v-if="status.retry" size="sm" variant="soft" @click="status.retry()">
        {{ messages.retry }}
      </DouButton>
    </div>
    <div v-else-if="status.state === 'empty'" class="dou-dashboard__status is-empty">
      <DouEmpty size="sm" :title="status.message || messages.empty" />
    </div>
  </div>
</template>
