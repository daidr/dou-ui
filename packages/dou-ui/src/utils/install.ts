import { hasInjectionContext, inject } from 'vue'
import type { App, Component, HTMLAttributes, Plugin } from 'vue'
import { configProviderKey } from '../components/config-provider/config-provider'

type InstanceProps<I> = I extends { $props: infer P } ? P : {}

/**
 * 组件在模板里可以写的属性：自己的 props 之外，再加上它转交给元素的原生属性和事件 `A`。
 * 与 props、事件同名的项以组件自己的为准。
 *
 * 只影响模板的类型检查（例如开启 checkUnknownProps 时 `<DouInput placeholder="…">` 不报错），
 * `InstanceType`、`ComponentDefaults` 读到的仍是组件自己的 props。
 */
export type WithAttributes<T, A> = T extends abstract new (...args: any) => infer I
  ? { new (...args: any[]): I & { $props: Omit<A, keyof InstanceProps<I>> } } & T
  : T

/**
 * 泛型组件的类型不能在导出时改写，改在 `defineProps` 里用交叉类型并上它，
 * 并在它前面加 `@vue-ignore` 注释让编译器跳过：这些属性在运行时仍是透传属性。
 * `Own` 是组件自己的 props，`Events` 是它自己的事件名，与它们同名的原生属性和事件以组件的为准。
 */
export type ForwardedAttributes<A, Own, Events extends string = never> = Omit<
  A,
  keyof Own | `on${Capitalize<Events>}`
>

/**
 * `A` 是组件转交的原生属性，默认是通用的 HTML 属性；
 * 把属性交给 `<input>` 的组件写 `InputHTMLAttributes`，不渲染元素的组件写 `{}`。
 */
export type WithInstall<T, A = HTMLAttributes> = WithAttributes<T, A> & Plugin

/** Attach an `install` method so a component can be used with `app.use()`. */
export function withInstall<T extends Component, A = HTMLAttributes>(
  component: T,
): WithInstall<T, A> {
  const target = component as unknown as WithInstall<T, A>
  target.install = (app: App) => {
    const { name } = component as { name?: string }
    if (!name) throw new Error('[dou-ui] component registered with app.use() must have a name')
    app.component(name, component)
  }
  readConfiguredDefaults(component)
  return target
}

type PropOption = {
  type?: unknown
  default?: unknown
  skipFactory?: boolean
}

/**
 * Let `ConfigProvider`'s `defaults` fill in props the component wasn't
 * given. Each prop's default becomes a factory that looks up the
 * configured value first; Vue runs default factories inside the
 * component, so `inject` sees the nearest provider.
 */
function readConfiguredDefaults(component: Component) {
  const { name, props } = component as { name?: string; props?: Record<string, PropOption | null> }
  if (!name || !props || Array.isArray(props)) return
  for (const [key, option] of Object.entries(props)) {
    const own: PropOption = option && typeof option === 'object' ? option : {}
    // a function-typed prop takes its default as the value itself, never as a factory
    if (own.type === Function || own.skipFactory) continue
    const hasDefault = 'default' in own
    const fallback = own.default
    const types = Array.isArray(own.type) ? own.type : [own.type]
    props[key] = {
      ...own,
      default(raw: Record<string, unknown>) {
        const config = hasInjectionContext() ? inject(configProviderKey, undefined) : undefined
        const configured = (config?.value.defaults as Record<string, Record<string, unknown>>)?.[
          name
        ]?.[key]
        if (configured !== undefined) return configured
        if (!hasDefault) return types.includes(Boolean) ? false : undefined
        return typeof fallback === 'function' ? fallback(raw) : fallback
      },
    }
  }
}
