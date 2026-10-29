import type { Size, Tone } from '../../utils/types'

export type ProgressSize = Size
export type ProgressTone = Tone
/** A bar, a full ring, or a ring open at the bottom like a gauge. */
export type ProgressType = 'line' | 'circle' | 'dashboard'

export interface ProgressProps {
  /** How far along, from `0` to `max`. Leave it out while the amount is unknown. */
  value?: number
  max?: number
  tone?: ProgressTone
  type?: ProgressType
  /** The thickness of the bar or ring: 4, 6 or 8px. */
  size?: ProgressSize
  /** The diameter of a ring, in px. */
  width?: number
  /** The thickness of a ring in px, overriding `size`. */
  strokeWidth?: number
  /** Show the percentage after the bar, or inside a ring. */
  showValue?: boolean
  /** Names the bar for screen readers when there is no visible label. */
  label?: string
}

export interface ProgressSlots {
  /** Replaces the percentage shown by `showValue`; inside a ring it can hold any content. */
  value?: (props: { value: number; percent: number }) => unknown
}
