<script setup lang="ts">
import { computed, provide, useId, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { devWarn } from '../../utils/status-check'
import { dockKey } from './context'
import DockNodeView from './dock-node.vue'
import {
  findDockGroup,
  moveDockTab,
  nextDockGroupId,
  replaceDockNode,
  selectDockTab,
  splitDockTab,
} from './layout'
import type { TabDrag } from '../tabs/tab-drag'
import type { TabsMoveEvent, TabsValue } from '../tabs/tabs'
import type { DockEmits, DockPanel, DockProps, DockSlots } from './dock'
import type { DockGroup, DockNode, DockSide } from './layout'

defineOptions({ name: 'DouDock' })

const props = withDefaults(defineProps<DockProps>(), {
  panels: () => [],
  closable: false,
  addable: false,
  minSize: '120px',
})
const emit = defineEmits<DockEmits>()
const slots = defineSlots<DockSlots>()

const ns = useNamespace('dock')
const group = `dou-dock-${useId()}`

// Changes made in one go (a drop moves a tab and selects it) build on
// each other before the new layout comes back through the prop.
let latest = props.modelValue
watch(
  () => props.modelValue,
  (value) => (latest = value),
)
function commit(next: DockNode) {
  if (next === latest) return
  latest = next
  emit('update:modelValue', next)
}

const panels = computed(() => new Map(props.panels.map((entry) => [entry.value, entry])))
function panel(value: TabsValue): DockPanel | undefined {
  const found = panels.value.get(value)
  if (!found && process.env.NODE_ENV !== 'production')
    devWarn(
      `[dou-ui] DouDock: the tab "${value}" has no entry in \`panels\`; it is named by its value.`,
    )
  return found
}

function move(event: TabsMoveEvent) {
  const from = findDockGroup(latest, event.value)
  const to = event.to.name
  if (!from || to === undefined) return
  commit(moveDockTab(latest, event.value, to, event.to.index))
  emit('move', { value: event.value, from: from.id, to, index: event.to.index })
}

function canDrop(drag: TabDrag, target: DockGroup, side: DockSide | 'center') {
  const from = findDockGroup(latest, drag.value)
  if (!from) return false
  // the middle of its own group, or an edge of a group it is alone in, leaves it where it is
  if (from.id === target.id) return side !== 'center' && target.tabs.length > 1
  return true
}

function drop(drag: TabDrag, target: DockGroup, side: DockSide | 'center') {
  const from = findDockGroup(latest, drag.value)
  if (!from || !canDrop(drag, target, side)) return
  if (side === 'center') {
    const index = target.tabs.length
    commit(moveDockTab(latest, drag.value, target.id, index))
    emit('move', { value: drag.value, from: from.id, to: target.id, index })
    return
  }
  const id = props.createId?.(latest) ?? nextDockGroupId(latest)
  commit(splitDockTab(latest, drag.value, target.id, side, id))
  emit('split', { value: drag.value, from: from.id, target: target.id, side, group: id })
}

provide(dockKey, {
  group,
  size: () => props.size,
  closable: () => props.closable,
  addable: () => props.addable,
  minSize: () => props.minSize,
  panel,
  slots,
  resize: (node, size) => commit(replaceDockNode(latest, node, { ...node, size })),
  select(target, value) {
    if (findDockGroup(latest, value)?.id === target.id) commit(selectDockTab(latest, value))
  },
  move,
  canDrop,
  drop,
  remove: (value, target) => emit('remove', value, target.id),
  add: (target) => emit('add', target.id),
})
</script>

<template>
  <div :class="ns.b()">
    <DockNodeView :node="modelValue" />
  </div>
</template>
