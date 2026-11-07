import type { InjectionKey } from 'vue'
import type { SplitterLimit } from '../splitter/splitter'
import type { TabDrag } from '../tabs/tab-drag'
import type { TabsMoveEvent, TabsSize, TabsValue } from '../tabs/tabs'
import type { DockPanel, DockSlots } from './dock'
import type { DockGroup, DockNode, DockSide, DockSplit } from './layout'

export interface DockContext {
  /** The group name the tabs of this dock share. */
  group: string
  size: () => TabsSize | undefined
  closable: () => boolean
  addable: () => boolean
  min: () => SplitterLimit
  draggable: () => boolean
  panel: (value: TabsValue) => DockPanel | undefined
  slots: DockSlots
  resize: (node: DockSplit, size: number) => void
  select: (group: DockGroup, value: TabsValue) => void
  move: (event: TabsMoveEvent) => void
  /** Whether a drop on the body of `group` could do something. */
  canDrop: (drag: TabDrag, group: DockGroup, side: DockSide | 'center') => boolean
  drop: (drag: TabDrag, group: DockGroup, side: DockSide | 'center') => void
  remove: (value: TabsValue, group: DockGroup) => void
  add: (group: DockGroup) => void
  /** A pointer pressed or the focus moved into a group, or a tab was dropped on it. */
  use: (group: string) => void
  /** The place in the layout a group is shown in. */
  setCell: (id: string, el: unknown) => void
}

export const dockKey: InjectionKey<DockContext> = Symbol('DouDock')

export type { DockNode }
