import { contrastRatio, dark, flattenTokens, light, mixColors, parseColor } from '@dou-ui/theme'
import type { SheetStyle } from './model'

/*
 * Styles in plain colors, for files: a tone, which the grid colors from
 * the page's theme, becomes the color it has in the light theme, as a
 * file opened elsewhere can't follow the page.
 */

const tokens = new Map(flattenTokens(light))

/** Text for light backgrounds and for dark ones: each theme's own text color. */
const INK = tokens.get('--dou-color-text') ?? '#171717'
const PAPER = new Map(flattenTokens(dark)).get('--dou-color-text') ?? '#ededed'

/**
 * The text color that reads on a background of a set color, whatever the
 * page's theme: dark on light backgrounds, light on dark ones. `undefined`
 * for a color it can't work out, such as a theme variable, which follows
 * the theme along with the text.
 */
export function textOn(background: string): string | undefined {
  if (background.includes('var(')) return undefined
  // a mix of set colors, as color scales paint, is worked out first
  const color = lightThemeColor(background)
  try {
    return contrastRatio(color, INK) >= contrastRatio(color, PAPER) ? INK : PAPER
  } catch {
    return undefined
  }
}

/** A tone's text color, as `is-tone-*` colors it. */
const TONE_TEXT = (tone: string) => `var(--dou-color-${tone}-text)`

/** A tone's soft fill, as `is-fill-*` colors it. */
const TONE_FILL: Record<string, string> = {
  neutral: 'color-mix(in oklab, var(--dou-color-text) 6%, var(--dou-color-bg-surface))',
  primary: 'color-mix(in oklab, var(--dou-color-primary) 12%, var(--dou-color-bg-surface))',
  success: 'color-mix(in oklab, var(--dou-color-success) 12%, var(--dou-color-bg-surface))',
  warning: 'color-mix(in oklab, var(--dou-color-warning) 14%, var(--dou-color-bg-surface))',
  danger: 'color-mix(in oklab, var(--dou-color-danger) 12%, var(--dou-color-bg-surface))',
}

/** The arguments of a CSS function, split at the commas outside brackets. */
function args(text: string) {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      out.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  out.push(text.slice(start).trim())
  return out
}

/** A color of `color-mix` with its share, such as `red 20%`. */
function mixPart(arg: string): { color: string; amount?: number } {
  const m = /^(.*?)\s+([\d.]+)%$/.exec(arg)
  return m ? { color: m[1]!, amount: Number(m[2]) / 100 } : { color: arg }
}

/**
 * A color as the light theme paints it, as `#rrggbb` where it can be
 * worked out: theme variables and `color-mix(in oklab, …)` of them. Other
 * colors, such as `red`, are given back as they are.
 */
export function lightThemeColor(css: string): string {
  const text = css.trim()
  const variable = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(text)
  if (variable) {
    const value = tokens.get(variable[1]!) ?? variable[2]
    return value ? lightThemeColor(value) : text
  }
  const mix = /^color-mix\(\s*in\s+oklab\s*,(.*)\)$/i.exec(text)
  if (mix) {
    const [first, second] = args(mix[1]!)
    if (!first || !second) return text
    const a = mixPart(first)
    const b = mixPart(second)
    const amount = a.amount ?? (b.amount != null ? 1 - b.amount : 0.5)
    const from = lightThemeColor(a.color)
    const to = lightThemeColor(b.color)
    try {
      return mixColors(from, to, amount)
    } catch {
      return text
    }
  }
  try {
    parseColor(text)
    return text.toLowerCase()
  } catch {
    return text
  }
}

/**
 * A style with its `tone` and `fill` as the colors they are in the light
 * theme, in `color` and `background`, and every color plain.
 */
export function plainStyle(style: SheetStyle): SheetStyle {
  const { tone, fill, ...rest } = style
  const out: SheetStyle = { ...rest }
  const color = rest.color ?? (tone ? TONE_TEXT(tone) : undefined)
  const background = rest.background ?? (fill ? TONE_FILL[fill] : undefined)
  if (color) out.color = lightThemeColor(color)
  if (background) out.background = lightThemeColor(background)
  return out
}
