import type { Tone } from '../../utils/types'

export type AlertTone = Tone

export interface AlertProps {
  /** What the message means; also picks the icon. */
  tone?: AlertTone
  /** A short heading above the description. */
  title?: string
  /** Show a button that dismisses the alert. */
  closable?: boolean
  /** Draw the tone's icon before the text. */
  showIcon?: boolean
}

export interface AlertEmits {
  /** The close button was pressed. The alert hides itself. */
  close: [event: MouseEvent]
}

export interface AlertSlots {
  /** The description. */
  default?: () => unknown
  title?: () => unknown
  /** Replaces the tone's icon. */
  icon?: () => unknown
  /** Actions at the end, e.g. a link or a small button. */
  action?: () => unknown
}
