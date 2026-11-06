<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, onUpdated, ref, useTemplateRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouSplitter } from '../splitter'
import { DouTabPanel, DouTabs } from '../tabs'
import { registerTabDropZone } from '../tabs/tab-drag'
import { dockKey } from './context'
import type { FunctionalComponent } from 'vue'
import type { SplitterLimit } from '../splitter/splitter'
import type { DockNode, DockSide } from './layout'

defineOptions({ name: 'DouDockNode' })

const props = defineProps<{ node: DockNode }>()
const dock = inject(dockKey)!
const ns = useNamespace('dock')

/* a split: the part on the other side keeps the smallest size too */

const splitRef = useTemplateRef<{ $el: HTMLElement }>('split')
const length = ref(0)
let observer: ResizeObserver | undefined
onMounted(() => {
  const el = splitRef.value?.$el
  if (!el || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(() => {
    const rect = el.getBoundingClientRect()
    length.value =
      props.node.type === 'split' && props.node.direction === 'vertical' ? rect.height : rect.width
  })
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

const toPercent = (limit: SplitterLimit) =>
  typeof limit === 'number'
    ? limit
    : length.value
      ? (Number.parseFloat(limit) / length.value) * 100
      : 0
const max = computed(() => 100 - toPercent(dock.minSize()))

/* a group: the edges of its body split a tab off, the middle takes it in */

const groupRef = useTemplateRef<HTMLElement>('group')
const target = ref<DockSide | 'center' | null>(null)

function sideAt(x: number, y: number): DockSide | 'center' {
  const rect = groupRef.value!.getBoundingClientRect()
  const edgeX = Math.max(24, rect.width / 4)
  const edgeY = Math.max(24, rect.height / 4)
  // the nearest edge within reach, measured relative to its reach
  const reach = [
    ['left', (x - rect.left) / edgeX],
    ['right', (rect.right - x) / edgeX],
    ['top', (y - rect.top) / edgeY],
    ['bottom', (rect.bottom - y) / edgeY],
  ] as const
  let best: DockSide | 'center' = 'center'
  let nearest = 1
  for (const [side, d] of reach)
    if (d < nearest) {
      nearest = d
      best = side
    }
  return best
}

const zone = registerTabDropZone({
  el: () => groupRef.value,
  accepts: (drag) => drag.group === dock.group && props.node.type === 'group',
  over(drag, x, y) {
    if (props.node.type !== 'group') return
    const side = sideAt(x, y)
    target.value = dock.canDrop(drag, props.node, side) ? side : null
  },
  leave: () => (target.value = null),
  drop(drag) {
    const side = target.value
    target.value = null
    if (side && props.node.type === 'group') dock.drop(drag, props.node, side)
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
  <DouSplitter
    v-if="node.type === 'split'"
    ref="split"
    :class="ns.e('split')"
    :model-value="node.size ?? 50"
    :direction="node.direction"
    :min="dock.minSize()"
    :max="max"
    @update:model-value="dock.resize(node, $event)"
  >
    <template #start><DouDockNode :node="node.start" /></template>
    <template #end><DouDockNode :node="node.end" /></template>
  </DouSplitter>
  <div
    v-else
    ref="group"
    :class="[ns.e('group'), ns.is('empty', !node.tabs.length)]"
    :data-dock-group="node.id"
  >
    <DouTabs
      :model-value="node.active ?? node.tabs[0]"
      :name="node.id"
      :group="dock.group"
      :size="dock.size()"
      :closable="dock.closable()"
      :addable="dock.addable()"
      height="100%"
      draggable
      @update:model-value="$event !== undefined && dock.select(node, $event)"
      @move="dock.move"
      @remove="dock.remove($event, node)"
      @add="dock.add(node)"
    >
      <DouTabPanel
        v-for="value in node.tabs"
        :key="value"
        :value="value"
        :label="label(value)"
        :icon="dock.panel(value)?.icon"
        :closable="dock.panel(value)?.closable"
        :disabled="dock.panel(value)?.disabled"
      >
        <template v-if="dock.slots.label" #label="{ selected }">
          <Outlet :render="() => dock.slots.label?.({ value, selected })" />
        </template>
        <Outlet :render="() => dock.slots.default?.({ value })" />
      </DouTabPanel>
    </DouTabs>
    <div v-if="!node.tabs.length && dock.slots.empty" :class="ns.e('empty')">
      <Outlet :render="() => dock.slots.empty?.()" />
    </div>
    <div
      :class="[ns.e('drop'), target && ns.is(target, true), ns.is('shown', !!target)]"
      aria-hidden="true"
    />
  </div>
</template>
