import type {
  AllowedComponentProps,
  ComponentCustomProps,
  ComputedRef,
  GlobalComponents,
  InjectionKey,
  VNodeProps,
} from 'vue'
import type { Locale } from '../../locale/types'
import type { ownComponent } from '../../utils/install'
import type { Size } from '../../utils/types'
import type { MotionMode } from '../../composables/use-motion'

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
  /**
   * How much the page animates: `auto` follows the system setting,
   * `reduce` keeps only short fades, `none` turns animation off. It is
   * applied to the whole page, since popups render outside the provider.
   * Defaults to `auto`.
   */
  motion?: MotionMode
}

export interface ResolvedGlobalConfig {
  size: Size
  locale: Locale
  zIndex: number
  teleport?: string | HTMLElement | false
  defaults: ComponentDefaults
  motion: MotionMode
}

/**
 * 泛型组件自己的 props。泛型组件的类型是函数，参数里还并着透传的原生属性，
 * 推不出只属于组件的 props，所以各自在这里登记，`ComponentDefaults` 按它取。
 */
export interface GenericComponentProps {}

// 透传给根元素的属性（class、style、aria-*、data-*、key、ref 等）不是 prop，默认值填不进去
type OwnProps<P> = Omit<
  P,
  keyof VNodeProps | keyof AllowedComponentProps | keyof ComponentCustomProps
>

type PropsOf<K, T> = K extends keyof GenericComponentProps
  ? GenericComponentProps[K]
  : // 组件原本的类型：`withInstall` 加在前面给模板看的构造签名带着透传的原生属性
    T extends { readonly [ownComponent]?: infer C }
    ? InstanceProps<C>
    : InstanceProps<T>

type InstanceProps<T> = T extends abstract new (...args: never) => { $props: infer P }
  ? OwnProps<P>
  : Record<string, unknown>

/** Default props for each DouUI component. */
export type ComponentDefaults = {
  [K in keyof GlobalComponents as K extends `Dou${string}` ? K : never]?: Partial<
    PropsOf<K, GlobalComponents[K]>
  >
}

export interface ConfigProviderProps extends GlobalConfig {}

export interface ConfigProviderSlots {
  default?: () => unknown
}

export const configProviderKey: InjectionKey<ComputedRef<GlobalConfig>> =
  Symbol('DouConfigProvider')
