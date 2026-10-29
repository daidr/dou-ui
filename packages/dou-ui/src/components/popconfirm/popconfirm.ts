import type { Placement } from '../../composables/use-floating'

export type PopconfirmTone = 'neutral' | 'warning' | 'danger'

export interface PopconfirmProps {
  /** Whether it is open, bound with `v-model:open`. */
  open?: boolean
  /** The question, e.g. "删除这条记录？". */
  title?: string
  /** What happens if the action goes ahead. */
  description?: string
  /** `danger` makes the confirm button a danger button, for actions that cannot be undone. */
  tone?: PopconfirmTone
  confirmText?: string
  cancelText?: string
  /**
   * Runs on confirm. While a returned promise is pending the button shows
   * a spinner; the popover closes once it resolves and stays open if it rejects.
   */
  onConfirm?: () => unknown
  placement?: Placement
  disabled?: boolean
  /** The width of the panel; a number is in px. */
  width?: string | number
  teleport?: string | HTMLElement | false
}

export interface PopconfirmEmits {
  'update:open': [value: boolean]
  cancel: []
}

export interface PopconfirmSlots {
  /** The trigger, usually a button. */
  default?: () => unknown
  icon?: () => unknown
  title?: () => unknown
  description?: () => unknown
}
