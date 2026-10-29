import { hasInjectionContext, inject } from 'vue'
import type { App, Component, Plugin } from 'vue'
import { configProviderKey } from '../components/config-provider/config-provider'

export type WithInstall<T> = T & Plugin

/** Attach an `install` method so a component can be used with `app.use()`. */
export function withInstall<T extends Component>(component: T): WithInstall<T> {
  const target = component as WithInstall<T>
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
