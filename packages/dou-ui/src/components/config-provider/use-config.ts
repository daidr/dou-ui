import { computed, hasInjectionContext, inject, provide, toValue } from 'vue'
import type { App, ComputedRef, MaybeRefOrGetter } from 'vue'
import { zhCN } from '../../locale/zh-cn'
import type { Locale } from '../../locale/types'
import { configProviderKey } from './config-provider'
import type { GlobalConfig, ResolvedGlobalConfig } from './config-provider'

const defaults: ResolvedGlobalConfig = {
  size: 'md',
  locale: zhCN,
  zIndex: 2000,
  defaults: {},
  motion: 'auto',
}

function defined(config: GlobalConfig): GlobalConfig {
  return Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined))
}

/**
 * Provide defaults to every component below the current one, or to the
 * whole app when `app` is given. Values left `undefined` fall through to
 * the nearest provider above.
 */
export function provideGlobalConfig(
  config: MaybeRefOrGetter<GlobalConfig>,
  app?: App,
): ComputedRef<GlobalConfig> {
  const parent = !app && hasInjectionContext() ? inject(configProviderKey, undefined) : undefined
  const merged = computed(() => {
    const own = defined(toValue(config))
    const result: GlobalConfig = { ...parent?.value, ...own }
    // component defaults merge per component, so a nested provider can add to them
    if (parent?.value.defaults && own.defaults) {
      const perComponent: Record<string, object | undefined> = { ...parent.value.defaults }
      for (const [name, props] of Object.entries(own.defaults as Record<string, object>)) {
        perComponent[name] = { ...perComponent[name], ...props }
      }
      result.defaults = perComponent as GlobalConfig['defaults']
    }
    return result
  })
  if (app) app.provide(configProviderKey, merged)
  else provide(configProviderKey, merged)
  return merged
}

/** The config in effect for the current component, with defaults filled in. */
export function useGlobalConfig(): ComputedRef<ResolvedGlobalConfig> {
  const config = hasInjectionContext() ? inject(configProviderKey, undefined) : undefined
  return computed(() => ({ ...defaults, ...config?.value }))
}

type MessagePath<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends object
      ? `${K}.${MessagePath<T[K]>}`
      : never
}[keyof T & string]

export type LocaleMessagePath = MessagePath<Locale>

export type TranslateParams = Record<string, string | number>

/** Fill `{name}` placeholders. */
export function format(message: string, params?: TranslateParams): string {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}

export function translate(locale: Locale, path: LocaleMessagePath, params?: TranslateParams) {
  let value: unknown = locale
  for (const key of path.split('.')) value = (value as Record<string, unknown>)?.[key]
  return typeof value === 'string' ? format(value, params) : path
}

/** Read strings from the locale in effect. */
export function useLocale() {
  const config = useGlobalConfig()
  const locale = computed(() => config.value.locale)
  const t = (path: LocaleMessagePath, params?: TranslateParams) =>
    translate(locale.value, path, params)
  return { locale, t }
}

let counter = 0

/**
 * Stack floating layers. Each call to `next()` returns a `z-index` above
 * every one handed out before, starting from the configured base.
 */
export function useZIndex() {
  const config = useGlobalConfig()
  const base = computed(() => config.value.zIndex)
  return {
    base,
    current: () => base.value + counter,
    next: () => base.value + ++counter,
  }
}
