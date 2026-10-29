import { withInstall } from '../../utils/install'
import Qrcode from './qrcode.vue'

export const DouQrcode = withInstall(Qrcode)
export default DouQrcode

export { encodeQr } from './encode'
export type { QrCode } from './encode'
export type * from './qrcode'
export type QrcodeInstance = InstanceType<typeof Qrcode>

declare module 'vue' {
  export interface GlobalComponents {
    DouQrcode: typeof DouQrcode
  }
}
