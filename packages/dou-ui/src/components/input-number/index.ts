import type { InputHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import InputNumber from './input-number.vue'

export const DouInputNumber = withInstall<typeof InputNumber, InputHTMLAttributes>(InputNumber)
export default DouInputNumber

export type * from './input-number'
export type InputNumberInstance = InstanceType<typeof InputNumber>

declare module 'vue' {
  export interface GlobalComponents {
    DouInputNumber: typeof DouInputNumber
  }
}
