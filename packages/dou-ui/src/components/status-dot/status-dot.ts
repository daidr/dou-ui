import type { PropType } from 'vue'
import type { Size, Tone } from '../../utils/types'

export type StatusDotTone = Tone
export type StatusDotSize = Size

export interface StatusDotProps {
  /** What the state means. `neutral` is gray, for offline or idle. */
  tone?: StatusDotTone
  /** The dot's diameter: 6, 8 or 10px. */
  size?: StatusDotSize
  /**
   * A slow ripple spreading from the dot, for something live or under way.
   * Pure CSS; a still halo when motion is reduced.
   */
  ripple?: boolean
  /**
   * Read by screen readers when no text sits beside the dot, e.g. "在线".
   * Without it a bare dot is not announced.
   */
  label?: string
}

export interface StatusDotSlots {
  /** Text beside the dot, e.g. "运行中". */
  default?: () => unknown
}

/**
 * The runtime props of the render-function component, kept next to
 * `StatusDotProps`; a type test checks that the two stay the same.
 */
export const statusDotProps = {
  tone: { type: String as PropType<StatusDotTone>, default: 'neutral' },
  size: { type: String as PropType<StatusDotSize>, default: 'md' },
  ripple: { type: Boolean, default: false },
  label: { type: String, default: undefined },
}
