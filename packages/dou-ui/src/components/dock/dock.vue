<script setup lang="ts">
import { computed, nextTick, provide, shallowReactive, useId, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { devWarn } from '../../utils/status-check'
import { dockKey } from './context'
import DockGroupView from './dock-group.vue'
import DockNodeView from './dock-node.vue'
import {
  dockGroups,
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

const DEFAULT_MIN = '120px'

const props = withDefaults(defineProps<DockProps>(), {
  panels: () => [],
  closable: false,
  addable: false,
  draggable: true,
  min: DEFAULT_MIN,
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
  // a parent that turned the change down keeps its layout: build on that from now on
  void nextTick(() => (latest = props.modelValue))
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

/** Where a tab is now. */
function locate(value: TabsValue) {
  const found = findDockGroup(latest, value)
  return found && { group: found.id, index: found.tabs.indexOf(value) }
}

function move(event: TabsMoveEvent) {
  const from = locate(event.value)
  const to = event.to.name
  if (!from || to === undefined) return
  commit(moveDockTab(latest, event.value, to, event.to.index))
  emit('move', { value: event.value, from, to: { group: to, index: event.to.index } })
}

function canDrop(drag: TabDrag, target: DockGroup, side: DockSide | 'center') {
  const from = findDockGroup(latest, drag.value)
  if (!from) return false
  // the middle of its own group, or an edge of a group it is alone in, leaves it where it is
  if (from.id === target.id) return side !== 'center' && target.tabs.length > 1
  return true
}

function drop(drag: TabDrag, target: DockGroup, side: DockSide | 'center') {
  const from = locate(drag.value)
  if (!from || !canDrop(drag, target, side)) return
  if (side === 'center') {
    const index = target.tabs.length
    commit(moveDockTab(latest, drag.value, target.id, index))
    emit('move', { value: drag.value, from, to: { group: target.id, index } })
    return
  }
  const id = props.createId?.(latest) ?? nextDockGroupId(latest)
  commit(splitDockTab(latest, drag.value, target.id, side, id))
  emit('split', { value: drag.value, from, target: target.id, side, group: id })
}

// Each group is rendered here, in one flat list, and teleported into its
// place in the layout: splitting or merging the parts around a group moves
// it, and its content (state, scroll position) stays as it is.
const groups = computed(() => dockGroups(props.modelValue))
const cells = shallowReactive(new Map<string, HTMLElement>())
function setCell(id: string, el: unknown) {
  if (el instanceof HTMLElement) {
    if (cells.get(id) !== el) cells.set(id, el)
  } else if (cells.has(id) && !cells.get(id)!.isConnected) cells.delete(id)
}

// Moving a group in the page resets what scrolled inside it: note the
// offsets before a change of shape moves groups, and put them back after.
const shape = (node: DockNode): string =>
  node.type === 'group' ? node.id : `${node.direction[0]}(${shape(node.start)},${shape(node.end)})`
let scrolled: [Element, number, number][] = []
watch(
  () => shape(props.modelValue),
  () => {
    scrolled = []
    for (const cell of cells.values())
      for (const el of cell.querySelectorAll('*'))
        if (el.scrollTop || el.scrollLeft) scrolled.push([el, el.scrollTop, el.scrollLeft])
  },
  { flush: 'pre' },
)
watch(
  () => shape(props.modelValue),
  () => {
    const notes = scrolled
    scrolled = []
    const restore = () => {
      for (const [el, top, left] of notes) {
        el.scrollTop = top
        el.scrollLeft = left
      }
    }
    restore()
    // a group whose place appears in this update moves in on the next one
    void nextTick(restore)
  },
  { flush: 'post' },
)

provide(dockKey, {
  group,
  size: () => props.size,
  closable: () => props.closable,
  addable: () => props.addable,
  min(direction) {
    const min = props.min
    if (typeof min !== 'object') return min
    return (direction === 'horizontal' ? min.width : min.height) ?? DEFAULT_MIN
  },
  draggable: () => props.draggable,
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
  setCell,
})
</script>

<template>
  <div :class="ns.b()">
    <DockNodeView :node="modelValue" />
    <!-- until its place exists (and on the server) a group renders right here -->
    <Teleport
      v-for="item in groups"
      :key="item.id"
      :to="cells.get(item.id) ?? 'body'"
      :disabled="!cells.get(item.id)"
    >
      <DockGroupView :group="item" />
    </Teleport>
  </div>
</template>
