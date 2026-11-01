import type { InputHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import Input from './input.vue'

export const DouInput = withInstall<typeof Input, InputHTMLAttributes>(Input)
export default DouInput

export type * from './input'
export type InputInstance = InstanceType<typeof Input>

declare module 'vue' {
  export interface GlobalComponents {
    DouInput: typeof DouInput
  }
}
