import type { ThemeTokens } from './types'

export const CSS_VAR_PREFIX = 'dou'

/**
 * Turn a token path into its CSS custom property name.
 *
 * ```ts
 * cssVarName('color.primary')      // '--dou-color-primary'
 * cssVarName('control.height.md')  // '--dou-control-height-md'
 * ```
 */
export function cssVarName(path: string): string {
  const segments = path
    .split('.')
    .filter((segment) => segment !== 'DEFAULT')
    .map(kebab)
  return `--${CSS_VAR_PREFIX}-${segments.join('-')}`
}

/** Flatten a token tree into `[cssVarName, value]` pairs. */
export function flattenTokens(tokens: ThemeTokens): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  const walk = (node: unknown, path: string[]) => {
    if (typeof node === 'string') {
      entries.push([cssVarName(path.join('.')), node])
      return
    }
    if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node)) walk(value, [...path, key])
    }
  }
  walk(tokens, [])
  return entries
}

/**
 * Serialize a theme into a CSS rule.
 *
 * Themes are plain custom properties, so they can be scoped to any subtree:
 * pass a selector such as `.sidebar` to theme only part of a page.
 */
export function themeToCss(tokens: ThemeTokens, selector = ':root'): string {
  const body = flattenTokens(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')
  return `${selector} {\n${body}\n}\n`
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}
