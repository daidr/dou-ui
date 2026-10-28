import { withInstall } from '../../utils/install'
import Radio from './radio.vue'
import RadioGroup from './radio-group.vue'

export const DouRadio = withInstall(Radio)
export const DouRadioGroup = withInstall(RadioGroup)
export default DouRadio

export { radioGroupKey } from './radio'
export type * from './radio'
export type RadioInstance = InstanceType<typeof Radio>
export type RadioGroupInstance = InstanceType<typeof RadioGroup>

declare module 'vue' {
  export interface GlobalComponents {
    DouRadio: typeof DouRadio
    DouRadioGroup: typeof DouRadioGroup
  }
}
