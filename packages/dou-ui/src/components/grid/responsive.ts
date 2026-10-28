import type { GridBreakpoint, Responsive } from './grid'

export const breakpoints = ['base', 'sm', 'md', 'lg', 'xl'] as const satisfies readonly (
  'base' | GridBreakpoint
)[]

export type ResponsiveKey = (typeof breakpoints)[number]

function isObject<T>(value: Responsive<T>): value is Exclude<Responsive<T>, T> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Spread a responsive value into one entry per breakpoint it sets. */
export function resolveResponsive<T>(
  value: Responsive<T> | undefined,
): Partial<Record<ResponsiveKey, T>> {
  if (value === undefined) return {}
  if (!isObject(value)) return { base: value as T }
  return value as Partial<Record<ResponsiveKey, T>>
}

/** `--prefix` for `base`, `--prefix-md` for the others. */
export const responsiveVar = (prefix: string, key: ResponsiveKey) =>
  key === 'base' ? prefix : `${prefix}-${key}`
