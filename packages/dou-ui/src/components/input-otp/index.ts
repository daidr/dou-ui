import { withInstall } from '../../utils/install'
import InputOtp from './input-otp.vue'

export const DouInputOtp = withInstall(InputOtp)
export default DouInputOtp

export type * from './input-otp'
export type InputOtpInstance = InstanceType<typeof InputOtp>

declare module 'vue' {
  export interface GlobalComponents {
    DouInputOtp: typeof DouInputOtp
  }
}
