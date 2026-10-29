import type { AvatarProps } from '../avatar/avatar'
import type { Size } from '../../utils/types'

export type UserSize = Size

export interface UserProps {
  /** Who this is. Also gives the avatar its initials and accessible name. */
  name?: string
  /** A second line under the name, e.g. a role or an email. */
  description?: string
  /** The avatar's image URL, or its props. Without one the avatar shows the initials. */
  avatar?: string | AvatarProps
  /** `sm`, `md` or `lg`; sets the avatar and the text together. */
  size?: UserSize
}

export interface UserSlots {
  /** Replaces the avatar, e.g. with one that carries a badge. */
  avatar?: () => unknown
  /** Replaces the name, e.g. with a link. */
  name?: () => unknown
  /** Replaces the description. */
  description?: () => unknown
  /** At the end of the row, e.g. a menu button. */
  default?: () => unknown
}
