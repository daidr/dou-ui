import type { QrLevel } from './encode'

export type QrcodeLevel = QrLevel
/** `expired` covers the code with a note and a refresh button; `loading` with a spinner. */
export type QrcodeStatus = 'active' | 'expired' | 'loading'

export interface QrcodeProps {
  /** The text to encode, e.g. a link. */
  value: string
  /** Width and height in px, quiet zone included. */
  size?: number
  /** How much of the code may be damaged or covered and still read. Raised to `H` with an icon. */
  level?: QrcodeLevel
  /** The quiet zone around the code, in modules. */
  margin?: number
  /** The dark modules. Near black by default, in both themes. */
  color?: string
  /** The light modules and quiet zone. White by default, in both themes. */
  bgColor?: string
  /** An image drawn in the middle, e.g. a logo. */
  icon?: string
  /** The icon's size in px. Defaults to a fifth of the code. */
  iconSize?: number
  status?: QrcodeStatus
  /** Shown over an expired code. */
  expiredText?: string
}

export interface QrcodeEmits {
  /** The refresh button of an expired code was pressed. */
  refresh: []
}

export interface QrcodeSlots {
  /** Replaces what covers the code while it is expired or loading. */
  status?: (props: { status: QrcodeStatus }) => unknown
}
