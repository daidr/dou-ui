import { withInstall } from '../../utils/install'
import ConfigProvider from './config-provider.vue'

export const DouConfigProvider = withInstall(ConfigProvider)
export default DouConfigProvider

export { configProviderKey } from './config-provider'
export { provideGlobalConfig, useGlobalConfig, useLocale, useZIndex } from './use-config'
export type * from './config-provider'
export type { LocaleMessagePath, TranslateParams } from './use-config'
export type ConfigProviderInstance = InstanceType<typeof ConfigProvider>

declare module 'vue' {
  export interface GlobalComponents {
    DouConfigProvider: typeof DouConfigProvider
  }
}
