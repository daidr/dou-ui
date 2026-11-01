import type { AnchorHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import Link from './link.vue'

export const DouLink = withInstall<typeof Link, AnchorHTMLAttributes>(Link)
export default DouLink

export type * from './link'
export type LinkInstance = InstanceType<typeof Link>

declare module 'vue' {
  export interface GlobalComponents {
    DouLink: typeof DouLink
  }
}
