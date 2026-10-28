import { withInstall } from '../../utils/install'
import Avatar from './avatar.vue'
import AvatarGroup from './avatar-group.vue'

export const DouAvatar = withInstall(Avatar)
export const DouAvatarGroup = withInstall(AvatarGroup)
export default DouAvatar

export type * from './avatar'
export type AvatarInstance = InstanceType<typeof Avatar>
export type AvatarGroupInstance = InstanceType<typeof AvatarGroup>

declare module 'vue' {
  export interface GlobalComponents {
    DouAvatar: typeof DouAvatar
    DouAvatarGroup: typeof DouAvatarGroup
  }
}
