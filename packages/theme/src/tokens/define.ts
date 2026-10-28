import type { DeepPartial, ThemeTokens } from './types'

/**
 * Create a theme by overriding parts of a base theme.
 *
 * ```ts
 * const brand = defineTheme(light, { color: { primary: { DEFAULT: '#7c3aed' } } })
 * ```
 */
export function defineTheme(base: ThemeTokens, overrides: DeepPartial<ThemeTokens>): ThemeTokens {
  return merge(base as unknown as Tree, overrides as Tree) as unknown as ThemeTokens
}

type Tree = { [key: string]: unknown }

function isTree(value: unknown): value is Tree {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function merge(base: Tree, overrides: Tree): Tree {
  const result: Tree = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue
    const current = result[key]
    result[key] = isTree(current) && isTree(value) ? merge(current, value) : value
  }
  return result
}
