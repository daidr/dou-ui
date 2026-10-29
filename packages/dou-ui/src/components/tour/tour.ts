import type { Placement } from '../../composables/use-floating'

export type TourTarget = string | HTMLElement | (() => HTMLElement | null | undefined)

export interface TourStep {
  /** The element to point at: a selector, an element or a function returning one. Left out, the step shows in the middle of the screen. */
  target?: TourTarget
  title?: string
  description?: string
  /** Where the card sits next to the target. Defaults to the tour's `placement`. */
  placement?: Placement
  /** Overrides the tour's `mask` for this step. */
  mask?: boolean
}

export interface TourProps {
  steps: TourStep[]
  /** Shown or not, bound with `v-model:open`. */
  open?: boolean
  /** The index of the step shown, bound with `v-model:current`. Defaults to `0`. */
  current?: number
  /** Dim the page around the target. */
  mask?: boolean
  /** Close when the dimmed area is pressed. */
  closeOnMask?: boolean
  closeOnEscape?: boolean
  placement?: Placement
  /** The room left around the target in the highlight, in px. */
  padding?: number
  /** Show "2 / 5" in the footer. */
  showProgress?: boolean
  /** Where the tour renders; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface TourEmits {
  'update:open': [open: boolean]
  'update:current': [current: number]
  /** The step shown changed. */
  change: [current: number]
  /** The last step's button was pressed. */
  finish: []
  /** The tour was closed before the end: close button, `Escape` or the mask. */
  close: []
}

export interface TourSlotProps {
  step: TourStep
  current: number
  total: number
}

export interface TourSlots {
  /** Replaces the description. */
  default?: (props: TourSlotProps) => unknown
  /** Replaces the title. */
  title?: (props: TourSlotProps) => unknown
  /** Replaces the buttons in the footer. */
  actions?: (
    props: TourSlotProps & { prev: () => void; next: () => void; close: () => void },
  ) => unknown
}

export interface TourExpose {
  next: () => void
  prev: () => void
  close: () => void
}
