import type { ComputedRef, InjectionKey } from 'vue'
import type { Locale } from '../../locale/types'
import type { Size } from '../../utils/types'

/** Defaults shared by every component below a provider or an app. */
export interface GlobalConfig {
  /** The size of components that do not set one. Defaults to `md`. */
  size?: Size
  /** The strings components render on their own. Defaults to `zhCN`. */
  locale?: Locale
  /** The lowest `z-index` handed to floating layers. Defaults to `2000`. */
  zIndex?: number
}

export interface ResolvedGlobalConfig {
  size: Size
  locale: Locale
  zIndex: number
}

export interface ConfigProviderProps extends GlobalConfig {}

export interface ConfigProviderSlots {
  default?: () => unknown
}

export const configProviderKey: InjectionKey<ComputedRef<GlobalConfig>> =
  Symbol('DouConfigProvider')
