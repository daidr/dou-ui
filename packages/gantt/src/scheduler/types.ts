import type { ContextMenuItem } from 'dou-ui'
import type { GanttCalendar } from '../core/calendar'
import type { GanttClassValue, GanttTask } from '../core/model'
import type { GanttTime } from '../core/time'
import type { GanttDocument, GanttTransaction, GanttTransactionMeta } from '../core/transaction'
import type { GanttMessagesOverride } from '../locale'
import type { GanttBarLabel, GanttMarker, GanttViewport } from '../types'
import type { SchedulerResource } from './layout'

/** Summary of a rendered group or resource row, passed to `rowClass`. */
export interface SchedulerRowInfo {
  kind: 'group' | 'resource'
  /** Group name for group rows, resource id for resource rows, or `''` for the unassigned row. */
  key: string
  title: string
  resource: SchedulerResource | null
  /** Group name for a group row, or the resource's group when inside one. */
  group?: string
  /** Number of resources in the group (for group rows) or tasks in the row (for resource rows). */
  count: number
  overloaded: boolean
  selected: boolean
}

/** Vertical layout geometry of an expanded scheduler row, in body px. */
export interface SchedulerRowBox {
  kind: 'group' | 'resource'
  /** Group name for group rows, resource id for resource rows, or `''` for the unassigned row. */
  key: string
  resource: SchedulerResource | null
  top: number
  height: number
  /** Vertical center of the row's first lane (or row middle for groups), in body px. */
  centerY: number
  lanes: number
}

/** Geometry of a task bar on the scheduler canvas, in body px. */
export interface SchedulerBarBox {
  task: GanttTask
  resource: SchedulerResource | null
  /** Resource id, or `''` for the unassigned row. */
  resourceId: string
  lane: number
  left: number
  right: number
  width: number
  top: number
  height: number
  centerY: number
  milestone: boolean
}

/** Scope passed to the `#rail` top auxiliary track slot. */
export interface SchedulerRailScope {
  viewport: GanttViewport
  xOf: (time: GanttTime) => number | null
  timeAt: (x: number) => number
  totalWidth: number
  height: number
}

/** Scope passed to `#underlay` and `#overlay` canvas layer slots. */
export interface SchedulerCanvasScope {
  viewport: GanttViewport
  xOf: (time: GanttTime) => number | null
  timeAt: (x: number) => number
  rowBox: (resourceId: string) => SchedulerRowBox | null
  barBox: (taskId: string) => SchedulerBarBox | null
  totalWidth: number
  totalHeight: number
  rows: readonly SchedulerRowBox[]
}

export interface SchedulerProps {
  /** The rows, in order. Tasks go to the row named by their `resource`. */
  resources: SchedulerResource[]
  /** The working calendar: workdays, days off and working hours. Pass `false` to disable. */
  calendar?: GanttCalendar | false
  /** A fixed span for the time axis, `[start, end]` as dates or timestamps. Without it the axis follows the tasks. */
  range?: [GanttTime, GanttTime]
  /** Show a line at the current time. */
  today?: boolean
  /**
   * External current time (e.g. a server-calibrated timestamp). Drives the `today`
   * line, `follow` anchor and `fit([start, end])` follow detection; pausing updates
   * to `now` freezes live panning without turning `follow` off. Defaults to the
   * local clock.
   */
  now?: GanttTime
  /** The first day of the week; defaults to the locale's. */
  weekStart?: 0 | 1
  /** Vertical marker lines, shaded time bands (`endDate`), or swimlane-scoped discrete event markers (`resource`). */
  markers?: GanttMarker[]
  /** Show the list of resources beside the timeline. */
  table?: boolean
  /** Width of the resource list, in px. Supports `v-model:tableWidth`. */
  tableWidth?: number
  /** Height of a row with one lane, in px. Each extra lane adds 28px. */
  rowHeight?: number
  /** Height of the top auxiliary rail rendered by `#rail` / `#rail-header`, in px. Defaults to `36` when used. */
  railHeight?: number
  /** Where a bar's title goes: `auto`, `inside`, `outside` or `none`. Defaults to `auto`. */
  barLabel?: GanttBarLabel
  /**
   * Show native browser `title` tooltips on task bars and event markers. Defaults
   * to `true`; automatically suppressed when `#bar-tooltip` / `#marker-tooltip` is used.
   */
  nativeTitle?: boolean
  /** Currently selected resource id (or `''` for unassigned); supports `v-model:selectedResource`. */
  selectedResource?: string | null
  /** Extra CSS class(es) applied to both the left list row and the timeline swimlane row. */
  rowClass?: string | ((row: SchedulerRowInfo) => GanttClassValue | undefined)
  /** Names of currently collapsed groups; supports `v-model:collapsedGroups`. */
  collapsedGroups?: string[]
  /** Show how busy each resource is, under its row. */
  load?: boolean
  readonly?: boolean
  /**
   * The last check before a task is moved, resized or given to another
   * resource, by dragging or by keys. Return `true` to allow it; anything
   * else refuses it, and a string is shown as the reason.
   */
  canMove?: (move: SchedulerMove, doc: GanttDocument) => boolean | string
  /** The built-in context menu item: remove. Turn off to keep only `contextMenu`'s items. */
  menu?: boolean
  /** Your own context menu items, shown above the built-in ones; return none to add nothing. */
  contextMenu?: (target: SchedulerMenuTarget) => ContextMenuItem[]
  /**
   * The hairline frame and rounded corners. Off, the scheduler takes no
   * border at all, for a panel or card that already has an edge. On by
   * default.
   */
  bordered?: boolean
  ariaLabel?: string
  messages?: GanttMessagesOverride
}

/** A change of dates or resource about to be made. */
export interface SchedulerMove {
  task: GanttTask
  start: GanttTime
  end?: GanttTime
  /** The resource it goes to; `undefined` for the unassigned row. */
  resource?: string
}

/**
 * What a context menu was opened on: a task, or an empty part of a row.
 * `time` is the moment under the pointer, in minutes; from the keyboard it
 * is the task's start.
 */
export type SchedulerMenuTarget =
  | { kind: 'task'; task: GanttTask; resource: SchedulerResource | null; time: number }
  | { kind: 'row'; resource: SchedulerResource | null; time: number }

export interface SchedulerRange {
  /** The resource's id; `undefined` for the row of tasks without one. */
  resource?: string
  /** As a task would have them: dates for whole days, else date and time. */
  start: string
  end: string
}

export interface SchedulerEmits {
  /** Emitted when the resource list width changes via divider drag or keyboard. */
  'update:tableWidth': [width: number]
  /** Emitted when a resource row is clicked to update `v-model:selectedResource`. */
  'update:selectedResource': [id: string | null]
  /** Emitted when a group is expanded or collapsed to update `v-model:collapsedGroups`. */
  'update:collapsedGroups': [groups: string[]]
  /** Emitted when the visible time range, zoom level or viewport geometry changes. */
  viewportChange: [viewport: GanttViewport]
  /** After every change, including undo and redo. */
  transaction: [tr: GanttTransaction]
  taskClick: [task: GanttTask, event: MouseEvent]
  taskDblclick: [task: GanttTask, event: MouseEvent]
  /** Sent before the menu opens; `event.preventDefault()` keeps it closed. */
  taskContextmenu: [task: GanttTask, event: MouseEvent]
  /** A resource row (in the left list or empty swimlane track) was clicked. */
  resourceClick: [resource: SchedulerResource | null, event: MouseEvent]
  /** A time range was drawn on an empty part of a row; add a task for it if you like. */
  create: [range: SchedulerRange]
  /** A swimlane-scoped discrete event marker was clicked. */
  markerClick: [marker: GanttMarker, event: MouseEvent]
}

export interface SchedulerSlots {
  /** A task's bar label content. */
  bar?: (props: {
    task: GanttTask
    resource: SchedulerResource | null
    width: number
    placement: 'inside' | 'outside'
  }) => unknown
  /** Always-mounted interior content inside a bar element, regardless of `barLabel`. */
  'bar-content'?: (props: {
    task: GanttTask
    resource: SchedulerResource | null
    width: number
    milestone: boolean
  }) => unknown
  /** Rich tooltip content rendered via `DouTooltip` when hovering or focusing a bar. */
  'bar-tooltip'?: (props: { task: GanttTask; resource: SchedulerResource | null }) => unknown
  /** A resource in the list. */
  resource?: (props: {
    resource: SchedulerResource
    count: number
    overloaded: boolean
    selected: boolean
  }) => unknown
  /** Custom content for a group header row. */
  group?: (props: {
    group: string
    title: string
    resources: SchedulerResource[]
    count: number
    collapsed: boolean
    toggle: () => void
  }) => unknown
  /** Custom content for a swimlane-scoped discrete event marker. */
  marker?: (props: { marker: GanttMarker }) => unknown
  /** Rich tooltip content rendered via `DouTooltip` when hovering or focusing a swimlane marker. */
  'marker-tooltip'?: (props: { marker: GanttMarker }) => unknown
  /** Left column cell of the top auxiliary rail, width-synced with `tableWidth`. */
  'rail-header'?: (props: { width: number; height: number }) => unknown
  /** Top auxiliary rail synced with the time axis, pinned directly below the time header. */
  rail?: (props: SchedulerRailScope) => unknown
  /** Custom canvas layer rendered behind task bars in the timeline body coordinate space. */
  underlay?: (props: SchedulerCanvasScope) => unknown
  /** Custom canvas layer rendered above task bars in the timeline body coordinate space. */
  overlay?: (props: SchedulerCanvasScope) => unknown
  default?: () => unknown
}

export interface SchedulerExpose {
  /** Applies changes as one transaction, one undo step. */
  transact(fn: (tr: GanttTransaction) => void, meta?: GanttTransactionMeta): GanttTransaction
  undo(): boolean
  redo(): boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Zooms so that all tasks (or an explicit `[start, end]` range) fit. */
  fit(range?: [GanttTime, GanttTime]): void
  scrollToDate(date: GanttTime): void
  scrollToToday(): void
  scrollToTask(id: string): void
  focusTask(id: string): void
  zoomIn(): void
  zoomOut(): void
  /** Returns the current visible time range and timeline geometry. */
  getViewport(): GanttViewport
  /** Converts a `GanttTime` (date string or Unix ms) to canvas x, in px. */
  xOf(time: GanttTime): number | null
  /** Converts a canvas x (in px) to a Unix timestamp in ms. */
  timeAt(x: number): number
  /** Returns the vertical geometry of an expanded resource row, or `null` if hidden/missing. */
  rowBox(resourceId: string): SchedulerRowBox | null
  /** Returns the canvas geometry of a task bar, or `null` if hidden/missing. */
  barBox(taskId: string): SchedulerBarBox | null
}
