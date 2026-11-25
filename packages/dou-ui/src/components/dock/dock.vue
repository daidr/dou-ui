<script setup lang="ts">
import {
  computed,
  nextTick,
  provide,
  shallowReactive,
  useId,
  useTemplateRef,
  watch,
  watchEffect,
} from 'vue'
import { useResizeObserver } from '../../composables/use-element-size'
import { useNamespace } from '../../utils/namespace'
import { devWarn } from '../../utils/status-check'
import { dockKey } from './context'
import { roomForSplit } from './drop-side'
import DockGroupView from './dock-group.vue'
import DockNodeView from './dock-node.vue'
import {
  dockGroups,
  findDockGroup,
  mergeDockTab,
  moveDockTab,
  nextDockGroupId,
  replaceDockNode,
  selectDockTab,
  splitDockTab,
} from './layout'
import { isIgnoredDragPress, pressTab } from '../tabs/tab-drag'
import type { SplitterLimit } from '../splitter/splitter'
import type { TabDrag } from '../tabs/tab-drag'
import type { TabsMoveEvent, TabsValue } from '../tabs/tabs'
import type {
  DockDropItem,
  DockEmits,
  DockExpose,
  DockLocation,
  DockPanel,
  DockProps,
  DockSlots,
} from './dock'
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
const emit = defineEmits<Omit<DockEmits, 'update:activeGroup'>>()
const activeGroup = defineModel<string>('activeGroup')
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

/**
 * Find an existing tab in `target` that shares `value`'s `mergeId` when `value`
 * comes from another group or from outside the dock. Prefers a pinned tab.
 */
function findMergeTarget(target: DockGroup, value: TabsValue): TabsValue | undefined {
  const source = panels.value.get(value)
  if (source?.mergeId === undefined) return undefined
  const from = findDockGroup(latest, value)
  if (from?.id === target.id) return undefined
  let fallback: TabsValue | undefined
  for (const tab of target.tabs) {
    if (tab === value) continue
    const entry = panels.value.get(tab)
    if (entry?.mergeId !== source.mergeId || entry.disabled) continue
    if (entry.pinned) return tab
    if (fallback === undefined) fallback = tab
  }
  return fallback
}

function performMove(
  value: TabsValue,
  from: DockLocation | null,
  targetGroup: DockGroup,
  index: number,
) {
  const autoMerge = findMergeTarget(targetGroup, value)
  let resolvedMerge = autoMerge
  if (props.beforeMove) {
    const decision = props.beforeMove({
      value,
      from,
      to: { group: targetGroup.id, index },
      targetGroup,
      mergeInto: autoMerge,
    })
    if (decision === false) return
    if (typeof decision === 'object' && decision !== null && 'mergeInto' in decision) {
      resolvedMerge = decision.mergeInto ?? undefined
    }
  }
  if (resolvedMerge !== undefined) {
    if (!targetGroup.tabs.includes(resolvedMerge)) {
      if (process.env.NODE_ENV !== 'production')
        devWarn(
          `[dou-ui] DouDock: \`beforeMove\` returned \`mergeInto: "${resolvedMerge}"\`, which is not in group "${targetGroup.id}". The move was cancelled.`,
        )
      return
    }
    const next = mergeDockTab(latest, value, resolvedMerge)
    const mergedIndex = findDockGroup(next, resolvedMerge)?.tabs.indexOf(resolvedMerge) ?? 0
    commit(next)
    emit('move', {
      value,
      from,
      to: { group: targetGroup.id, index: mergedIndex },
      mergedInto: resolvedMerge,
    })
    use(targetGroup.id)
    return
  }
  commit(moveDockTab(latest, value, targetGroup.id, index))
  emit('move', { value, from, to: { group: targetGroup.id, index } })
  use(targetGroup.id)
}

function move(event: TabsMoveEvent) {
  const from = locate(event.value) ?? null
  const to = event.to.name
  if (to === undefined) return
  const targetGroup = dockGroups(latest).find((item) => item.id === to)
  if (!targetGroup) return
  performMove(event.value, from, targetGroup, event.to.index)
}

function canDrop(drag: TabDrag, target: DockGroup, side: DockSide | 'center') {
  const from = findDockGroup(latest, drag.value)
  // not in the layout yet: it opens anywhere
  if (!from) return true
  // the middle of its own group, or an edge of a group it is alone in, leaves it where it is
  if (from.id === target.id) return side !== 'center' && target.tabs.length > 1
  return true
}

function pinnedInsertIndex(target: DockGroup) {
  let index = 0
  for (let i = 0; i < target.tabs.length; i++) {
    if (panels.value.get(target.tabs[i]!)?.pinned) index = i + 1
  }
  return index
}

function drop(drag: TabDrag, target: DockGroup, side: DockSide | 'center') {
  const from = locate(drag.value) ?? null
  if (!canDrop(drag, target, side)) return
  if (side === 'center') {
    const index = drag.pinned ? pinnedInsertIndex(target) : target.tabs.length
    performMove(drag.value, from, target, index)
    return
  }
  const id = props.createId?.(latest) ?? nextDockGroupId(latest)
  commit(splitDockTab(latest, drag.value, target.id, side, id))
  emit('split', { value: drag.value, from, target: target.id, side, group: id })
  use(id)
}

/* the group last used */

function use(id: string | undefined) {
  // also unbound, it emits only a change
  if (id !== activeGroup.value) activeGroup.value = id
}
// a group dragged empty or closed, or one never in the layout, is not the one to open things in
watch(
  () =>
    activeGroup.value !== undefined && !findGroup(props.modelValue, activeGroup.value)
      ? activeGroup.value
      : undefined,
  (stale) => stale !== undefined && use(undefined),
  { immediate: true },
)

// Each group is rendered here, in one flat list, and teleported into its
// place in the layout: splitting or merging the parts around a group moves
// it, and its content (state, scroll position) stays as it is.
const groups = computed(() => dockGroups(props.modelValue))
function findGroup(layout: DockNode, id: string) {
  return dockGroups(layout).some((item) => item.id === id)
}
const cells = shallowReactive(new Map<string, HTMLElement>())
function setCell(id: string, el: unknown) {
  if (el instanceof HTMLElement) {
    if (cells.get(id) !== el) cells.set(id, el)
  } else if (cells.has(id) && !cells.get(id)!.isConnected) {
    cells.delete(id)
    sizes.delete(id)
  }
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
const RAPID_REPEAT_MS = 400
const RAPID_REPEAT_PX = 8
let lastDropPress: { time: number; x: number; y: number } | null = null

function isRapidRepeat(event: PointerEvent) {
  const now = Date.now()
  const x = event.clientX
  const y = event.clientY
  const repeated =
    event.detail > 1 ||
    (lastDropPress !== null &&
      now - lastDropPress.time <= RAPID_REPEAT_MS &&
      Math.hypot(x - lastDropPress.x, y - lastDropPress.y) <= RAPID_REPEAT_PX)
  lastDropPress = { time: now, x, y }
  return repeated
}

function startDrop(event: PointerEvent, item: DockDropItem) {
  if (isIgnoredDragPress(event)) return
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
  if (isRapidRepeat(event)) return
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
        pinned: !!entry?.pinned,
      }
    },
    onStart: () => {
      dragged = true
      lastDropPress = null
    },
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

function minFor(direction: 'horizontal' | 'vertical'): SplitterLimit {
  const min = props.min
  if (typeof min !== 'object') return min
  return (direction === 'horizontal' ? min.width : min.height) ?? DEFAULT_MIN
}

if (process.env.NODE_ENV !== 'production')
  watchEffect(() => {
    for (const direction of ['horizontal', 'vertical'] as const) {
      const min = minFor(direction)
      if (typeof min === 'number' && min > 50)
        devWarn(
          `[dou-ui] DouDock: \`min\` of ${min} is a percent, so no group can be split ${direction === 'horizontal' ? 'side by side' : 'top to bottom'}. Write '${min}px' for px.`,
        )
    }
  })

// the size of each group's place, kept up to date so `canSplit` can be read in a render
const sizes = shallowReactive(new Map<string, { width: number; height: number }>())
useResizeObserver(
  () => [...cells.values()],
  (entries) => {
    for (const entry of entries)
      for (const [id, el] of cells)
        if (el === entry.target) {
          const box = entry.borderBoxSize?.[0]
          sizes.set(id, {
            width: box ? box.inlineSize : entry.contentRect.width,
            height: box ? box.blockSize : entry.contentRect.height,
          })
        }
  },
  { box: 'border-box' },
)

/**
 * Whether a group has room to split a tab off to `side`: two parts of
 * `min` beside the divider, as dragging to its edge checks. Reactive.
 */
function canSplit(groupId: string, side: DockSide) {
  const el = cells.get(groupId)
  if (!el) return false
  const across = side === 'left' || side === 'right'
  const size = sizes.get(groupId) ?? el.getBoundingClientRect()
  return roomForSplit(across ? size.width : size.height, minFor(across ? 'horizontal' : 'vertical'))
}
defineExpose<DockExpose>({ canSplit, startDrop })

provide(dockKey, {
  group,
  size: () => props.size,
  closable: () => props.closable,
  addable: () => props.addable,
  min: minFor,
  draggable: () => props.draggable,
  panel,
  slots,
  resize: (node, size) => commit(replaceDockNode(latest, node, { ...node, size })),
  select(target, value) {
    if (findDockGroup(latest, value)?.id === target.id) commit(selectDockTab(latest, value))
  },
  move,
  mergeTarget: (drag, target) => findMergeTarget(target, drag.value),
  canDrop,
  drop,
  remove: (value, target) => emit('remove', value, target.id),
  add: (target) => emit('add', target.id),
  use,
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
      <DockGroupView
        :group="item"
        :slotted="{ label: !!$slots.label, extra: !!$slots.extra, empty: !!$slots.empty }"
      />
    </Teleport>
  </div>
</template>
