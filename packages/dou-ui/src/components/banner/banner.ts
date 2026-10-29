import type { Tone } from '../../utils/types'

export type BannerTone = Tone
export type BannerVariant = 'soft' | 'solid'

export interface BannerProps {
  /** What the notice means; also picks the icon. */
  tone?: BannerTone
  /** `soft` tints the bar; `solid` fills it with the tone. */
  variant?: BannerVariant
  /** A short heading before the message, in bold. */
  title?: string
  /** Draw the tone's icon before the text. */
  showIcon?: boolean
  /** Show a button that hides the banner. */
  closable?: boolean
  /** Shown or not. Bound with `v-model:open`; defaults to shown. */
  open?: boolean
}

export interface BannerEmits {
  'update:open': [open: boolean]
  /** The close button was pressed. */
  close: [event: MouseEvent]
}

export interface BannerSlots {
  /** The message. */
  default?: () => unknown
  title?: () => unknown
  /** Replaces the tone's icon. */
  icon?: () => unknown
  /** Links or small buttons after the message. */
  action?: () => unknown
}
