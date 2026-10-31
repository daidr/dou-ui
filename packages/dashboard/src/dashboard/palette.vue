<script setup lang="ts">
import { computed } from 'vue'
import { format, useDashboardMessages } from '../locale'
import type { DashboardWidgetType } from '../widget/define'
import type { DashboardPaletteProps } from './types'

defineOptions({ name: 'DouDashboardPalette' })

const props = withDefaults(defineProps<DashboardPaletteProps>(), {
  for: null,
  direction: 'vertical',
})
defineSlots<{
  /** Replaces what a button shows; `type` is the widget type. */
  default?: (props: { type: DashboardWidgetType<any> }) => unknown
}>()

const messages = useDashboardMessages()
const dashboard = computed(() => props.for)
const list = computed(() => {
  const all = dashboard.value?.types ?? []
  if (!props.types) return all
  const byName = new Map(all.map((type) => [type.type, type]))
  return props.types.flatMap((name) => byName.get(name) ?? [])
})
const disabled = computed(() => !dashboard.value?.editable)
</script>

<template>
  <ul
    :class="['dou-dashboard-palette', `is-${direction}`]"
    role="list"
    :aria-label="messages.palette"
  >
    <li v-for="type in list" :key="type.type">
      <button
        type="button"
        class="dou-dashboard-palette__item"
        :disabled="disabled"
        :aria-label="format(messages.paletteItem, { label: type.label })"
        @pointerdown="dashboard?.startAdd($event, type.type)"
        @click="dashboard?.addWidget(type.type)"
      >
        <slot :type="type">
          <component :is="type.icon" v-if="type.icon" class="dou-dashboard-palette__icon" />
          <span class="dou-dashboard-palette__label">{{ type.label }}</span>
        </slot>
      </button>
    </li>
  </ul>
</template>
