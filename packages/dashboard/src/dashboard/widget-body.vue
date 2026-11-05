<script setup lang="ts">
import { AlertCircleIcon } from '@dou-ui/icons'
import { DouButton, DouEmpty, DouSpinner } from 'dou-ui'
import { inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useErrorBoundary } from './error-boundary'
import type { SheetWorkbook } from '@dou-ui/sheet/core'
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
  /** Where the widget's workbook goes, for its export menu; the full-screen copy has none. */
  setWorkbook?: (id: string, get: () => SheetWorkbook | undefined) => () => void
  /** Told when the widget's content breaks, for the dashboard's `widgetError`. */
  reportError?: (id: string, error: unknown) => void
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
const { status, data } = provideWidgetContext({
  widget: () => props.widget,
  editing: () => props.editing,
  fullscreen: () => !!props.fullscreen,
  size: { width, height },
  setProps: props.setProps,
  setWorkbook: props.setWorkbook,
})

// A widget that throws while it sets up or draws, e.g. for props from JSON
// it can't use, shows an error in its own card; the other widgets and the
// page go on. It tries again when its props or data change, or on retry.
const failed = useErrorBoundary(
  () => `widget "${props.widget.id}" (${props.widget.type})`,
  (error) => props.reportError?.(props.widget.id, error),
)
const retryRender = () => (failed.value = false)
watch(() => props.widget.props, retryRender, { deep: true })
watch(data, retryRender)

// A retry that fails again brings back a new retry button: focus moves to
// it, rather than falling to the page, if it was on the old one and
// nothing took it meanwhile.
const root = ref<HTMLElement>()
let refocus = false
function retry(again: () => void) {
  refocus = !!root.value?.querySelector('.dou-dashboard__status')?.contains(document.activeElement)
  again()
  nextTick(settle)
}
/** After a retry: once it has failed or worked, puts focus back on the new retry button if it failed. */
function settle() {
  if (!refocus || (!failed.value && status.value.state === 'loading')) return
  refocus = false
  if (!failed.value && status.value.state !== 'error') return
  const active = document.activeElement
  if (active && active !== document.body) return
  root.value?.querySelector<HTMLElement>('.dou-dashboard__status button')?.focus()
}
// data loads later: settle when it fails or arrives
watch(() => status.value.state, settle, { flush: 'post' })
</script>

<template>
  <div ref="root" class="dou-dashboard__body" :aria-busy="status.state === 'loading' || undefined">
    <div ref="body" class="dou-dashboard__content">
      <template v-if="failed" />
      <component :is="type.component" v-else-if="type" />
      <div v-else class="dou-dashboard__notice">
        {{ format(messages.unknownType, { type: widget.type }) }}
      </div>
    </div>
    <div v-if="failed" class="dou-dashboard__status is-error" role="alert">
      <AlertCircleIcon class="dou-dashboard__status-icon" />
      <span>{{ messages.renderError }}</span>
      <DouButton size="sm" variant="soft" @click="retry(retryRender)">
        {{ messages.retry }}
      </DouButton>
    </div>
    <div
      v-else-if="status.state === 'loading'"
      class="dou-dashboard__status is-loading"
      role="status"
    >
      <DouSpinner size="sm" :label="messages.loading" />
    </div>
    <div v-else-if="status.state === 'error'" class="dou-dashboard__status is-error" role="alert">
      <AlertCircleIcon class="dou-dashboard__status-icon" />
      <span>{{ status.message || messages.error }}</span>
      <DouButton
        v-if="status.retry"
        size="sm"
        variant="soft"
        @click="retry(() => status.retry?.())"
      >
        {{ messages.retry }}
      </DouButton>
    </div>
    <div v-else-if="status.state === 'empty'" class="dou-dashboard__status is-empty">
      <DouEmpty size="sm" :title="status.message || messages.empty" />
    </div>
  </div>
</template>
