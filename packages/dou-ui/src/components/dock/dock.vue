<script setup lang="ts">
import { computed, nextTick, provide, shallowReactive, useId, useTemplateRef, watch } from 'vue'
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
import { pressTab } from '../tabs/tab-drag'
import type { TabDrag } from '../tabs/tab-drag'
import type { TabsMoveEvent, TabsValue } from '../tabs/tabs'
import type { DockDropItem, DockEmits, DockExpose, DockPanel, DockProps, DockSlots } from './dock'
import type { DockGroup, DockNode, DockSide } from './layout'

defineOptions({ name: 'DouDock' })

const props = withDefaults(defineProps<DockProps>(), {
  panels: () => [],
  closable: false,
  addable: false,
  draggable: true,
  min: '120px',
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
  const from = locate(event.value) ?? null
  const to = event.to.name
  if (to === undefined) return
  const index = event.to.index
  commit(moveDockTab(latest, event.value, to, index))
  emit('move', { value: event.value, from, to: { group: to, index } })
}

function canDrop(drag: TabDrag, target: DockGroup, side: DockSide | 'center') {
  const from = findDockGroup(latest, drag.value)
  // not in the layout yet: it opens anywhere
  if (!from) return true
  // the middle of its own group, or an edge of a group it is alone in, leaves it where it is
  if (from.id === target.id) return side !== 'center' && target.tabs.length > 1
  return true
}

function drop(drag: TabDrag, target: DockGroup, side: DockSide | 'center') {
  const from = locate(drag.value) ?? null
  if (!canDrop(drag, target, side)) return
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

/* dragging something from outside the dock in */

const root = useTemplateRef<HTMLElement>('root')

function startDrop(event: PointerEvent, item: DockDropItem) {
  // `currentTarget` is gone once the handler returns, after an `await`: then the element pressed
  const target = event.currentTarget ?? event.target
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) {
    if (process.env.NODE_ENV !== 'production')
      devWarn(
        '[dou-ui] DouDock: `startDrop` needs the `pointerdown` event of an element, to know what was pressed.',
      )
    return
  }
  const entry = panels.value.get(item.value)
  if (!props.draggable || entry?.disabled || entry?.draggable === false) {
    if (process.env.NODE_ENV !== 'production' && props.draggable)
      devWarn(
        `[dou-ui] DouDock: \`startDrop\` for "${item.value}" does nothing, as its panel is ${entry?.disabled ? 'disabled' : 'not draggable'}.`,
      )
    return
  }
  const label = item.label ?? entry?.label ?? String(item.value)
  // the browser's own drag of a link or an image would take the pointer away
  target.addEventListener('dragstart', noNativeDrag)
  const release = () => {
    target.removeEventListener('dragstart', noNativeDrag)
    window.removeEventListener('pointerup', release, true)
    window.removeEventListener('pointercancel', release, true)
  }
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
  let dragged = false
  pressTab(event, {
    el: target as HTMLElement,
    root: target as HTMLElement,
    ghost: { label, tabs: root.value?.querySelector<HTMLElement>('.dou-tabs') },
    drag: () => {
      // open already: a drag of it from its group, so dropping it back in its place does nothing
      const from = locate(item.value)
      return {
        value: item.value,
        label,
        group,
        name: from?.group,
        index: from?.index ?? -1,
        source: target,
      }
    },
    onStart: () => (dragged = true),
    onEnd() {
      if (!dragged) return
      // the release that ends a drag is not a click on the element
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
    },
  })
}
const noNativeDrag = (e: Event) => e.preventDefault()
const swallow = (click: Event) => {
  click.stopPropagation()
  click.preventDefault()
}
defineExpose<DockExpose>({ startDrop })

provide(dockKey, {
  group,
  size: () => props.size,
  closable: () => props.closable,
  addable: () => props.addable,
  min: () => props.min,
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
  <div ref="root" :class="ns.b()">
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
