<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, onUpdated, ref, useTemplateRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouTabPanel, DouTabs } from '../tabs'
import { registerTabDropZone } from '../tabs/tab-drag'
import { dockKey } from './context'
import { dockDropSide } from './drop-side'
import type { FunctionalComponent } from 'vue'
import type { DockGroup, DockSide } from './layout'

defineOptions({ name: 'DouDockGroup' })

const props = defineProps<{ group: DockGroup }>()
const dock = inject(dockKey)!
const ns = useNamespace('dock')

/* the edges of the body split a tab off, the middle takes it in */

const el = useTemplateRef<HTMLElement>('el')
const target = ref<DockSide | 'center' | null>(null)

function sideAt(x: number, y: number) {
  return dockDropSide(el.value!.getBoundingClientRect(), x, y, {
    width: dock.min('horizontal'),
    height: dock.min('vertical'),
  })
}

const zone = registerTabDropZone({
  el: () => el.value,
  accepts: (drag) => drag.group === dock.group,
  over(drag, x, y) {
    const side = sideAt(x, y)
    target.value = dock.canDrop(drag, props.group, side) ? side : null
  },
  leave: () => (target.value = null),
  drop(drag) {
    const side = target.value
    target.value = null
    if (side) dock.drop(drag, props.group, side)
  },
})
onMounted(() => zone.update())
onUpdated(() => zone.update())
onBeforeUnmount(() => zone.remove())

/** Renders what a slot of the dock gives back, under one component type so it is not remounted. */
const Outlet: FunctionalComponent<{ render: () => unknown }> = (outlet) =>
  outlet.render() as ReturnType<FunctionalComponent>

const label = (value: string | number) => dock.panel(value)?.label ?? String(value)
</script>

<template>
  <div
    ref="el"
    :class="[ns.e('group'), ns.is('empty', !group.tabs.length)]"
    :data-dock-group="group.id"
  >
    <DouTabs
      :model-value="group.active ?? group.tabs[0]"
      :name="group.id"
      :group="dock.group"
      :size="dock.size()"
      :closable="dock.closable()"
      :addable="dock.addable()"
      height="100%"
      :draggable="dock.draggable()"
      @update:model-value="$event !== undefined && dock.select(group, $event)"
      @move="dock.move"
      @remove="dock.remove($event, group)"
      @add="dock.add(group)"
    >
      <DouTabPanel
        v-for="value in group.tabs"
        :key="value"
        :value="value"
        :label="label(value)"
        :icon="dock.panel(value)?.icon"
        :closable="dock.panel(value)?.closable"
        :disabled="dock.panel(value)?.disabled"
        :draggable="dock.panel(value)?.draggable"
      >
        <template v-if="dock.slots.label" #label="{ selected }">
          <Outlet :render="() => dock.slots.label?.({ value, selected })" />
        </template>
        <Outlet :render="() => dock.slots.default?.({ value })" />
      </DouTabPanel>
    </DouTabs>
    <div v-if="!group.tabs.length && dock.slots.empty" :class="ns.e('empty')">
      <Outlet :render="() => dock.slots.empty?.()" />
    </div>
    <div
      :class="[ns.e('drop'), target && ns.is(target, true), ns.is('shown', !!target)]"
      aria-hidden="true"
    />
  </div>
</template>
