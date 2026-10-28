import type { Size, Tone } from '../../utils/types'

export type ProgressSize = Size
export type ProgressTone = Tone

export interface ProgressProps {
  /** How far along, from `0` to `max`. Leave it out while the amount is unknown. */
  value?: number
  max?: number
  tone?: ProgressTone
  /** The thickness of the bar: 4, 6 or 8px. */
  size?: ProgressSize
  /** Show the percentage after the bar. */
  showValue?: boolean
  /** Names the bar for screen readers when there is no visible label. */
  label?: string
}

export interface ProgressSlots {
  /** Replaces the percentage shown by `showValue`. */
  value?: (props: { value: number; percent: number }) => unknown
}
