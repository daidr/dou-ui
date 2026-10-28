import { withInstall } from '../../utils/install'
import Textarea from './textarea.vue'

export const DouTextarea = withInstall(Textarea)
export default DouTextarea

export type * from './textarea'
export type TextareaInstance = InstanceType<typeof Textarea>

declare module 'vue' {
  export interface GlobalComponents {
    DouTextarea: typeof DouTextarea
  }
}
