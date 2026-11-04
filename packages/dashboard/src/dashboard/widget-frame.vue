<script setup lang="ts">
import { DownloadIcon, MaximizeIcon, MoreHorizontalIcon } from '@dou-ui/icons'
import {
  DouAlert,
  DouButton,
  DouDropdown,
  DouDropdownItem,
  DouDropdownSub,
  DouEditable,
  DouTag,
  DouTooltip,
} from 'dou-ui'
import type { DropdownValue } from 'dou-ui'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GridLayoutHandle from '../grid/grid-handle.vue'
import { format } from '../locale'
import { frameContextKey } from './frame-context'
import type { WidgetAction } from './frame-context'
import { observersKey } from './observers'
import WidgetBody from './widget-body.vue'

defineOptions({ name: 'DouDashboardWidget' })

const props = defineProps<{ id: string }>()

const frame = inject(frameContextKey)!
const widget = computed(() => frame.widget(props.id))
const type = computed(() => widget.value && frame.type(widget.value))
const title = computed(() => (widget.value ? frame.title(widget.value) : ''))
const editing = computed(() => frame.editing())
const messages = computed(() => frame.messages())
/** The filters this widget set, each with a button to clear it. */
const linked = computed(() => frame.linked(props.id))
/** All of them in one tag (a pivot table's click sets one per field), cleared together. */
const linkLabel = computed(() => linked.value.map((link) => link.label).join(' / '))
function clearLinks() {
  for (const link of linked.value) frame.clearFilter(link.key)
}

/** Others at this widget, when editing together: an outline in the first one's color and their names. */
const peers = computed(() => frame.peers(props.id))
const peerText = (peer: { name: string; action: string }) => {
  const m = messages.value
  const text =
    peer.action === 'move'
      ? m.peerMoving
      : peer.action === 'resize'
        ? m.peerResizing
        : peer.action === 'settings'
          ? m.peerSettings
          : '{name}'
  return format(text, { name: peer.name })
}

const renaming = ref(false)

// Widgets far out of view show only their title until they come near: with
// hundreds of widgets, their contents and controls are most of the mounting.
const root = ref<HTMLElement>()
const active = ref(frame.eager(props.id))
const observers = inject(observersKey)
let stop: (() => void) | undefined
onMounted(() => {
  if (active.value || !observers) {
    active.value = true
    return
  }
  stop = observers.near(root.value!, () => {
    active.value = true
    stop?.()
  })
})
onBeforeUnmount(() => stop?.())
// the dashboard draws everything for an export only when this widget isn't drawn yet
watch(active, (drawn) => frame.setDrawn(props.id, drawn), { immediate: true })
onBeforeUnmount(() => frame.setDrawn(props.id, false))
// drawn in full to export or print the dashboard, and kept that way
watch(
  () => frame.all(),
  (all) => {
    if (!all || active.value) return
    active.value = true
    stop?.()
  },
  { immediate: true },
)
const canFullscreen = computed(() => type.value?.fullscreen !== false)

const emitAction = (action: WidgetAction) => frame.action(props.id, action)

/** The file types this widget's content can be exported as; none unless it gives a workbook. */
const exporters = computed(() => frame.exporters(props.id))
const exportError = computed(() => frame.exportError(props.id))
const exporting = computed(() => frame.exporting(props.id))
const EXPORT = 'export:'
const exportOpen = ref(false)

function onSelect(value: DropdownValue | undefined) {
  if (typeof value !== 'string') return
  if (value.startsWith(EXPORT)) frame.exportTo(props.id, value.slice(EXPORT.length))
  else emitAction(value as WidgetAction)
}
</script>

<template>
  <!-- outside the frame, which cuts off what overflows it -->
  <div v-if="widget && peers.length" class="dou-dashboard__peers" aria-hidden="true">
    <span
      v-for="peer in peers"
      :key="`${peer.client}:${peer.action}`"
      :class="['dou-dashboard__peer', `is-${peer.action}`]"
      :style="{ '--dou-dashboard-peer-color': peer.color }"
    >
      {{ peerText(peer) }}
    </span>
  </div>
  <div
    v-if="widget"
    ref="root"
    :class="['dou-dashboard__widget', peers.length && 'has-peers']"
    :style="peers.length ? { '--dou-dashboard-peer-color': peers[0]!.color } : undefined"
  >
    <template v-if="!active">
      <div class="dou-dashboard__header">
        <div class="dou-dashboard__title">{{ title }}</div>
      </div>
      <div class="dou-dashboard__body" />
    </template>
    <component
      v-else
      :is="editing ? GridLayoutHandle : 'div'"
      :as="editing ? 'header' : undefined"
      class="dou-dashboard__header"
    >
      <DouEditable
        v-if="editing"
        v-model:editing="renaming"
        class="dou-dashboard__title"
        :model-value="title"
        trigger="dblclick"
        select-on-edit
        :aria-label="messages.titleField"
        :data-dou-nodrag="renaming ? '' : undefined"
        @submit="(value) => frame.rename(id, value)"
      />
      <div v-else class="dou-dashboard__title">{{ title }}</div>
      <div v-if="linked.length" class="dou-dashboard__links" data-dou-nodrag>
        <DouTag
          size="sm"
          closable
          :close-label="format(messages.clearFilter, { value: linkLabel })"
          @close="clearLinks"
        >
          {{ format(messages.filteredBy, { value: linkLabel }) }}
        </DouTag>
      </div>
      <div class="dou-dashboard__actions" data-dou-nodrag>
        <DouDropdown v-if="editing" placement="bottom-end" @select="onSelect">
          <DouButton size="sm" variant="ghost" :aria-label="messages.widgetMenu">
            <MoreHorizontalIcon />
          </DouButton>
          <template #menu>
            <DouDropdownItem value="settings">{{ messages.settings }}</DouDropdownItem>
            <DouDropdownItem v-if="canFullscreen" value="fullscreen">
              {{ messages.fullscreen }}
            </DouDropdownItem>
            <DouDropdownSub v-if="exporters.length" :title="messages.export">
              <DouDropdownItem
                v-for="exporter in exporters"
                :key="exporter.name"
                :value="EXPORT + exporter.name"
                :disabled="exporting"
              >
                <template v-if="exporter.icon" #prefix><component :is="exporter.icon" /></template>
                {{ exporter.label }}
              </DouDropdownItem>
            </DouDropdownSub>
            <DouDropdownItem value="duplicate" shortcut="mod+d">
              {{ messages.duplicate }}
            </DouDropdownItem>
            <DouDropdownItem value="remove" tone="danger" shortcut="delete" divided>
              {{ messages.remove }}
            </DouDropdownItem>
          </template>
        </DouDropdown>
        <DouTooltip v-if="!editing && exporters.length" :content="messages.export">
          <DouDropdown v-model:open="exportOpen" placement="bottom-end" @select="onSelect">
            <DouButton
              size="sm"
              variant="ghost"
              :aria-label="messages.export"
              :loading="exporting"
              :disabled="exporting"
            >
              <DownloadIcon />
            </DouButton>
            <template #menu>
              <DouDropdownItem
                v-for="exporter in exporters"
                :key="exporter.name"
                :value="EXPORT + exporter.name"
              >
                <template v-if="exporter.icon" #prefix><component :is="exporter.icon" /></template>
                {{ exporter.label }}
              </DouDropdownItem>
            </template>
          </DouDropdown>
        </DouTooltip>
        <DouTooltip v-if="!editing && canFullscreen" :content="messages.fullscreen">
          <DouButton
            size="sm"
            variant="ghost"
            :aria-label="messages.fullscreen"
            @click="emitAction('fullscreen')"
          >
            <MaximizeIcon />
          </DouButton>
        </DouTooltip>
      </div>
    </component>
    <div v-if="exportError" class="dou-dashboard__export-error" data-dou-nodrag>
      <DouAlert tone="danger" closable @close="frame.clearExportError(id)">
        {{ exportError }}
      </DouAlert>
    </div>
    <WidgetBody
      v-if="active"
      :widget="widget"
      :type="type"
      :editing="editing"
      :messages="messages"
      :set-props="frame.setProps"
      :set-workbook="frame.setWorkbook"
    />
  </div>
</template>
