<script setup lang="ts">
import { MaximizeIcon, MoreHorizontalIcon } from '@dou-ui/icons'
import { DouButton, DouDropdown, DouDropdownItem, DouEditable, DouTag, DouTooltip } from 'dou-ui'
import type { DropdownValue } from 'dou-ui'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
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
const canFullscreen = computed(() => type.value?.fullscreen !== false)

const emitAction = (action: WidgetAction) => frame.action(props.id, action)

function onSelect(value: DropdownValue | undefined) {
  if (typeof value === 'string') emitAction(value as WidgetAction)
}
</script>

<template>
  <div v-if="widget" ref="root" class="dou-dashboard__widget">
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
          v-for="link in linked"
          :key="link.key"
          size="sm"
          closable
          :close-label="format(messages.clearFilter, { value: link.label })"
          @close="frame.clearFilter(link.key)"
        >
          {{ format(messages.filteredBy, { value: link.label }) }}
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
            <DouDropdownItem value="duplicate" shortcut="mod+d">
              {{ messages.duplicate }}
            </DouDropdownItem>
            <DouDropdownItem value="remove" tone="danger" shortcut="delete" divided>
              {{ messages.remove }}
            </DouDropdownItem>
          </template>
        </DouDropdown>
        <DouTooltip v-else-if="canFullscreen" :content="messages.fullscreen">
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
    <WidgetBody
      v-if="active"
      :widget="widget"
      :type="type"
      :editing="editing"
      :messages="messages"
      :set-props="frame.setProps"
    />
  </div>
</template>
