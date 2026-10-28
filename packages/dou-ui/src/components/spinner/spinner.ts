import type { Size } from '../../utils/types'

export type SpinnerSize = Size

export interface SpinnerProps {
  /** `sm` 12px, `md` 16px, `lg` 20px; a number is in px. */
  size?: SpinnerSize | number
  /** Read by screen readers. Defaults to the locale's "loading". */
  label?: string
}
