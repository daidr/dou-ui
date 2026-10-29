import { withInstall } from '../../utils/install'
import User from './user.vue'

export const DouUser = withInstall(User)
export default DouUser

export type * from './user'

declare module 'vue' {
  export interface GlobalComponents {
    DouUser: typeof DouUser
  }
}
