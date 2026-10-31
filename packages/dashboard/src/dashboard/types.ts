import type {
  DashboardStep,
  DashboardTransaction,
  DashboardTransactionMeta,
} from '../core/transaction'
import type { DashboardDocument, DashboardPlace } from '../core/types'
import type { GridCompact } from '../layout/types'
import type { DashboardMessagesOverride } from '../locale'
import type { DashboardWidgetType } from '../widget/define'

export interface DashboardProps {
  /** The dashboard, bound with `v-model`; a new document object after every change. */
  modelValue?: DashboardDocument
  /** The kinds of widget it can hold, made with `defineDashboardWidget`. */
  widgets?: DashboardWidgetType<any>[]
  /** Whether widgets can be added, moved, resized, changed and removed. */
  editable?: boolean
  /**
   * How many columns the grid has: one number, or one per breakpoint.
   * Defaults to `{ lg: 12, md: 6, sm: 1 }`.
   */
  columns?: number | Record<string, number>
  /** The narrowest width of the dashboard at which each breakpoint applies, in px. Defaults to `{ lg: 1024, md: 640, sm: 0 }`. */
  breakpoints?: Record<string, number>
  /** The height of a row, in px. Defaults to 80. */
  rowHeight?: number
  /** The space between widgets, in px: one number, or `[across, down]`. Defaults to 16. */
  gap?: number | [number, number]
  /** `'vertical'` (the default) floats widgets up into gaps; `false` leaves them where they are put. */
  compact?: GridCompact
  /** The dashboard's accessible name. */
  label?: string
  /** Overrides of the built-in texts. */
  messages?: DashboardMessagesOverride
  /** Makes the id of a new widget. Defaults to the type and a few random letters. */
  createId?: (type: string) => string
}

export interface DashboardEmits {
  'update:modelValue': [doc: DashboardDocument]
  /** After every change, with the steps that made it and those that undo it. */
  change: [transaction: DashboardTransaction]
  'breakpoint-change': [breakpoint: string]
}

export interface DashboardAddOptions {
  /** Where on the widest breakpoint; defaults to the first spot it fits. */
  at?: Pick<DashboardPlace, 'x' | 'y'>
  title?: string
  /** Merged over the type's `defaultProps`. */
  props?: Record<string, unknown>
  /** Moves focus to the new widget. Defaults to `true`. */
  focus?: boolean
}

export interface DashboardExpose {
  /** Applies steps as one change; returns it. */
  dispatch: (steps: DashboardStep[], meta?: DashboardTransactionMeta) => DashboardTransaction
  undo: () => boolean
  redo: () => boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Adds a widget of a registered type; returns its id, or `undefined` for an unknown type. */
  addWidget: (type: string, options?: DashboardAddOptions) => string | undefined
  removeWidget: (id: string) => void
  /** Adds a copy of a widget next to it; returns the copy's id. */
  duplicateWidget: (id: string) => string | undefined
  focusWidget: (id: string) => void
  /** Opens the settings drawer of a widget (while editing). */
  openSettings: (id: string) => void
  /** Shows a widget full screen. */
  openFullscreen: (id: string) => void
  /**
   * Starts dragging a new widget of a type in from outside: call it in that
   * element's `pointerdown`. See `DouGridLayout`'s `startDrop`.
   */
  startAdd: (event: PointerEvent, type: string) => void
  /** The registered widget types. */
  readonly types: readonly DashboardWidgetType<any>[]
  /** The breakpoint in use. */
  readonly breakpoint: string
  readonly editable: boolean
}

export interface DashboardPaletteProps {
  /** The dashboard it adds to (its component instance, from a template ref). */
  for?: DashboardExpose | null
  /** Only these types, in this order; defaults to every registered type. */
  types?: string[]
  /** How the list runs. Defaults to `vertical`. */
  direction?: 'vertical' | 'horizontal'
}
