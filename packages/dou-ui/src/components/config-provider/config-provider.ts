import type { ComputedRef, GlobalComponents, InjectionKey } from 'vue'
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
  /**
   * Where floating layers render when they don't set `teleport`
   * themselves. Defaults to `body`; `false` keeps them in place.
   */
  teleport?: string | HTMLElement | false
  /**
   * Default props per component, keyed by the registered name. A prop the
   * component is given still wins. Read when a component is created.
   *
   * ```ts
   * { DouButton: { variant: 'outline' }, DouTable: { stripe: true } }
   * ```
   */
  defaults?: ComponentDefaults
}

export interface ResolvedGlobalConfig {
  size: Size
  locale: Locale
  zIndex: number
  teleport?: string | HTMLElement | false
  defaults: ComponentDefaults
}

type PropsOf<T> = T extends abstract new (...args: never) => { $props: infer P }
  ? P
  : T extends (props: infer P, ...rest: never) => unknown
    ? P
    : Record<string, unknown>

/** Default props for each DouUI component. */
export type ComponentDefaults = {
  [K in keyof GlobalComponents as K extends `Dou${string}` ? K : never]?: Partial<
    PropsOf<GlobalComponents[K]>
  >
}

export interface ConfigProviderProps extends GlobalConfig {}

export interface ConfigProviderSlots {
  default?: () => unknown
}

export const configProviderKey: InjectionKey<ComputedRef<GlobalConfig>> =
  Symbol('DouConfigProvider')
