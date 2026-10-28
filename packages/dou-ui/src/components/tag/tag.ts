import type { Size, Tone } from '../../utils/types'

export type TagVariant = 'soft' | 'outline' | 'solid'
export type TagTone = Tone
export type TagSize = Size

export interface TagProps {
  /** Visual weight. Tags are quiet by default. */
  variant?: TagVariant
  tone?: TagTone
  size?: TagSize
  /** Show a remove button that emits `close`. */
  closable?: boolean
  /** Fully rounded ends, e.g. for counts and statuses. */
  round?: boolean
}

export interface TagEmits {
  close: [event: MouseEvent]
}

export interface TagSlots {
  default?: () => unknown
  /** Content placed before the label, e.g. an icon or a status dot. */
  leading?: () => unknown
}
