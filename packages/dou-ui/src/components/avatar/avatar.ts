import type { InjectionKey, Ref } from 'vue'
import type { Size } from '../../utils/types'

export type AvatarSize = Size
export type AvatarShape = 'circle' | 'square'

export interface AvatarProps {
  /** Image URL. Falls back to the initials, then an icon, when missing or broken. */
  src?: string
  /** Alternative text of the image. Defaults to `name`. */
  alt?: string
  /** Whose avatar this is. Gives the initials and the accessible name. */
  name?: string
  /** `sm` 24px, `md` 32px, `lg` 40px; a number is in px. Inherits from a group. */
  size?: AvatarSize | number
  /** Inherits from a group, otherwise `circle`. */
  shape?: AvatarShape
}

export interface AvatarSlots {
  /** Replaces the initials and the icon, e.g. with an emoji or a logo. */
  default?: () => unknown
}

export interface AvatarGroupProps {
  /** Show at most this many avatars, followed by a `+N` count. */
  max?: number
  size?: AvatarSize | number
  shape?: AvatarShape
}

export interface AvatarGroupSlots {
  /** The avatars, `DouAvatar`s. */
  default?: () => unknown
}

export interface AvatarGroupContext {
  size: Readonly<Ref<AvatarSize | number | undefined>>
  shape: Readonly<Ref<AvatarShape | undefined>>
}

export const avatarGroupKey: InjectionKey<AvatarGroupContext> = Symbol('DouAvatarGroup')
