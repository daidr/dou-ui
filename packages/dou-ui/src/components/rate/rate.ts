import type { Size, Tone } from '../../utils/types'

export type RateSize = Size
export type RateTone = Extract<Tone, 'neutral' | 'warning'>

export interface RateProps {
  /** The score, bound with `v-model`. `0` means no score. */
  modelValue?: number
  /** The number of stars. */
  max?: number
  /** Allow half stars. */
  allowHalf?: boolean
  /** Picking the current score again clears it. */
  clearable?: boolean
  /** Show the score without letting it change. */
  readonly?: boolean
  disabled?: boolean
  size?: RateSize
  /** `neutral` fills the stars with ink; `warning` with the warm tone. */
  tone?: RateTone
  /** Names a rating that has no visible label. */
  ariaLabel?: string
}

export interface RateEmits {
  'update:modelValue': [value: number]
  change: [value: number]
}

export interface RateSlots {
  /** Replaces the star, e.g. with a heart. Drawn twice: once empty, once filled and clipped. */
  icon?: (props: { index: number }) => unknown
  /** Shown after the stars, e.g. the score as text. */
  default?: (props: { value: number }) => unknown
}
