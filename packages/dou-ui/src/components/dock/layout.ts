import type { TabsValue } from '../tabs/tabs'

/** Two parts side by side or stacked, as a `DouSplitter` shows them. */
export interface DockSplit {
  type: 'split'
  /** `horizontal` puts `start` and `end` side by side; `vertical` stacks them. */
  direction: 'horizontal' | 'vertical'
  /** The size of `start` in percent. Defaults to 50. */
  size?: number
  start: DockNode
  end: DockNode
}

/** A group of tabs, shown as one `DouTabs`. */
export interface DockGroup {
  type: 'group'
  id: string
  /** The values of its tabs, in order. */
  tabs: TabsValue[]
  /** The selected tab. Defaults to the first. */
  active?: TabsValue
}

export type DockNode = DockSplit | DockGroup

/** The side of a group a tab is split off to. */
export type DockSide = 'top' | 'right' | 'bottom' | 'left'

function groups(node: DockNode): DockGroup[] {
  return node.type === 'group' ? [node] : [...groups(node.start), ...groups(node.end)]
}

/** The group a tab is in. */
export function findDockGroup(layout: DockNode, value: TabsValue) {
  return groups(layout).find((group) => group.tabs.includes(value))
}

/** The groups of a layout, from the top left. */
export function dockGroups(layout: DockNode) {
  return groups(layout)
}

/** An id that no group of the layout has yet, `group-1`, `group-2`… */
export function nextDockGroupId(layout: DockNode) {
  const ids = new Set(groups(layout).map((group) => group.id))
  let n = 1
  while (ids.has(`group-${n}`)) n++
  return `group-${n}`
}

/** Replace the nodes `map` returns something new for, keeping the rest. */
function mapNode(node: DockNode, map: (node: DockNode) => DockNode | null): DockNode | null {
  const own = map(node)
  if (own !== node) return own
  if (node.type === 'group') return node
  const start = mapNode(node.start, map)
  const end = mapNode(node.end, map)
  if (start === node.start && end === node.end) return node
  // a split with one side gone is the other side
  if (!start) return end
  if (!end) return start
  return { ...node, start, end }
}

/** Take a tab out of its group, dropping the group once it is empty. */
function takeOut(layout: DockNode, value: TabsValue, keep?: string): DockNode | null {
  return mapNode(layout, (node) => {
    if (node.type !== 'group' || !node.tabs.includes(value)) return node
    const index = node.tabs.indexOf(value)
    const tabs = node.tabs.filter((tab) => tab !== value)
    if (!tabs.length && node.id !== keep) return null
    const active =
      node.active === value ? (tabs[Math.min(index, tabs.length - 1)] ?? undefined) : node.active
    return { ...node, tabs, active }
  })
}

/** A layout with nothing left in it keeps one empty group. */
const orEmpty = (layout: DockNode | null, id: string): DockNode =>
  layout ?? { type: 'group', id, tabs: [] }

/**
 * Move a tab to a group, at `index` (counted without the tab itself) or
 * at the end, and select it there. The group it leaves is dropped once
 * it is empty. Returns a new layout; the one passed in is not changed.
 */
export function moveDockTab(
  layout: DockNode,
  value: TabsValue,
  groupId: string,
  index?: number,
): DockNode {
  const target = groups(layout).find((group) => group.id === groupId)
  if (!target) return layout
  const taken = takeOut(layout, value, groupId)
  const next = mapNode(orEmpty(taken, groupId), (node) => {
    if (node.type !== 'group' || node.id !== groupId) return node
    const tabs = [...node.tabs]
    tabs.splice(Math.min(Math.max(index ?? tabs.length, 0), tabs.length), 0, value)
    return { ...node, tabs, active: value }
  })
  return next!
}

/**
 * Split a tab off to one side of a group, into a new group of its own
 * that takes half of the group's place. Returns a new layout.
 */
export function splitDockTab(
  layout: DockNode,
  value: TabsValue,
  groupId: string,
  side: DockSide,
  newId: string = nextDockGroupId(layout),
): DockNode {
  const target = groups(layout).find((group) => group.id === groupId)
  // splitting a group's only tab off itself would leave it where it was
  if (!target || (target.tabs.length === 1 && target.tabs[0] === value)) return layout
  const taken = takeOut(layout, value, groupId)
  const added: DockGroup = { type: 'group', id: newId, tabs: [value], active: value }
  const next = mapNode(orEmpty(taken, groupId), (node) => {
    if (node.type !== 'group' || node.id !== groupId) return node
    const direction = side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
    const first = side === 'left' || side === 'top'
    return {
      type: 'split',
      direction,
      size: 50,
      start: first ? added : node,
      end: first ? node : added,
    }
  })
  return next!
}

/** Remove a tab, dropping its group once it is empty. Returns a new layout. */
export function removeDockTab(layout: DockNode, value: TabsValue): DockNode {
  const group = findDockGroup(layout, value)
  if (!group) return layout
  return orEmpty(takeOut(layout, value), group.id)
}

/** Select a tab in its group. Returns a new layout. */
export function selectDockTab(layout: DockNode, value: TabsValue): DockNode {
  return mapNode(layout, (node) =>
    node.type === 'group' && node.tabs.includes(value) && node.active !== value
      ? { ...node, active: value }
      : node,
  )!
}

/** Replace one node of the layout, found by identity. */
export function replaceDockNode(layout: DockNode, node: DockNode, next: DockNode): DockNode {
  return mapNode(layout, (current) => (current === node ? next : current))!
}
