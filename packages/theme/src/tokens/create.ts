import { defineTheme } from './define'
import { dark as darkBase } from './dark'
import { light as lightBase } from './light'
import type { ThemeTokens, ToneTokens } from './types'

/** Brand colors to build a theme from. Any tone left out keeps the base theme's value. */
export interface ThemeColors {
  primary?: string
  success?: string
  warning?: string
  danger?: string
}

export interface CreateThemeOptions {
  /** Light theme to start from. Defaults to the built-in `light`. */
  light?: ThemeTokens
  /** Dark theme to start from. Defaults to the built-in `dark`. */
  dark?: ThemeTokens
}

/** Minimum contrast for text (WCAG AA, normal text). */
const TEXT_CONTRAST = 4.5
/** Minimum contrast for the focus ring against the page (WCAG non-text). */
const FOCUS_CONTRAST = 3
/** How much of a tone goes into its `soft` tint over the surface. */
const SOFT_AMOUNT = 0.07

/**
 * Build a light and a dark theme from a few brand colors.
 *
 * Each color becomes a full tone: the color itself, the text color that
 * reads on it, a version that reads as text on the page, and a faint tint
 * for faint backgrounds. Tones that are not given keep their values, except
 * that a soft tint computed for another surface is mixed again over the
 * base theme's surface (a soft tint written by hand stays as it is). Lightness is
 * adjusted in OKLCH until every pair reaches 4.5:1, so the hue stays
 * recognizable while text stays legible. The focus ring follows `primary`.
 *
 * ```ts
 * const { light, dark } = createTheme({ primary: '#7c3aed' })
 * ```
 */
export function createTheme(
  colors: ThemeColors,
  options: CreateThemeOptions = {},
): { light: ThemeTokens; dark: ThemeTokens } {
  return {
    light: themeFor(options.light ?? lightBase, colors),
    dark: themeFor(options.dark ?? darkBase, colors),
  }
}

function themeFor(base: ThemeTokens, colors: ThemeColors): ThemeTokens {
  const color: Partial<ThemeTokens['color']> = {}
  for (const name of ['neutral', 'primary', 'success', 'warning', 'danger'] as const) {
    const value = name === 'neutral' ? undefined : colors[name]
    if (value) color[name] = createTone(value, base)
    else color[name] = retint(base.color[name], base)
  }
  if (colors.primary) color.focus = focusColor(colors.primary, base)
  return defineTheme(base, { color })
}

/**
 * Turn one color into a tone for the given theme. The theme's backgrounds
 * decide whether it is light or dark, and which surfaces the tone's text
 * has to read on.
 */
export function createTone(value: string, base: ThemeTokens = lightBase): ToneTokens {
  const surfaces = [base.color.bg.canvas, base.color.bg.surface, base.color.bg.muted].map(
    parseColor,
  )
  const isDark = luminance(surfaces[1]!) < 0.18
  const seed = toOklch(parseColor(value))

  // The filled color: keep the seed when either white or ink reads on it,
  // otherwise move it toward whichever needs less change.
  const white: Rgb = [1, 1, 1]
  const ink = parseColor(isDark ? base.color.neutral.on : base.color.neutral.DEFAULT)
  let fill = seed
  let on = pickOn(fromOklch(fill), white, ink)
  if (!on) {
    const darker = adjust(seed, -1, (rgb) => contrast(rgb, white) >= TEXT_CONTRAST)
    const lighter = adjust(seed, 1, (rgb) => contrast(rgb, ink) >= TEXT_CONTRAST)
    fill = Math.abs(darker[0] - seed[0]) <= Math.abs(lighter[0] - seed[0]) ? darker : lighter
    on = pickOn(fromOklch(fill), white, ink)!
  }

  const DEFAULT = toHex(fromOklch(fill))
  const soft = softTint(DEFAULT, base)

  const text = readableText(toHex(fromOklch(fill)), soft, base)

  return { DEFAULT, on: toHex(on), text, soft }
}

/**
 * A tone that was not given keeps its colors. Only a soft tint that was
 * computed for another surface (the built-in themes', when the base changed
 * its surface) is mixed again over the base's surface; a tint written by
 * hand stays. The text moves only if it no longer reads on the new tint.
 */
function retint(tone: ToneTokens, base: ThemeTokens): ToneTokens {
  const computed = [lightBase, darkBase, base].some(
    (theme) => tone.soft === softTint(tone.DEFAULT, theme),
  )
  if (!computed) return tone
  const soft = softTint(tone.DEFAULT, base)
  if (soft === tone.soft) return tone
  return { ...tone, soft, text: readableText(tone.text, soft, base) }
}

function softTint(color: string, base: ThemeTokens): string {
  return mixColors(color, base.color.bg.surface, SOFT_AMOUNT)
}

/**
 * The color as text: kept when it reads on every page surface and on the
 * tone's own soft tint, otherwise moved away from the page until it does.
 */
function readableText(color: string, soft: string, base: ThemeTokens): string {
  const backgrounds = [base.color.bg.canvas, base.color.bg.surface, base.color.bg.muted, soft].map(
    parseColor,
  )
  const isDark = luminance(backgrounds[1]!) < 0.18
  const reads = (rgb: Rgb) =>
    backgrounds.every((surface) => contrast(rgb, surface) >= TEXT_CONTRAST)
  const rgb = parseColor(color)
  if (reads(rgb)) return color
  return toHex(fromOklch(adjust(toOklch(rgb), isDark ? 1 : -1, reads)))
}

/** A softer version of the primary color that still stands out from the page. */
function focusColor(value: string, base: ThemeTokens): string {
  const page = parseColor(base.color.bg.canvas)
  const isDark = luminance(page) < 0.18
  const [l, c, h] = toOklch(parseColor(value))
  // light themes lift the ring toward the page, dark themes keep it low
  const start: Oklch = [isDark ? Math.min(l, 0.58) : Math.max(l, 0.62), c * 0.8, h]
  const visible = (rgb: Rgb) => contrast(rgb, page) >= FOCUS_CONTRAST
  const ring = visible(fromOklch(start)) ? start : adjust(start, isDark ? 1 : -1, visible)
  return toHex(fromOklch(ring))
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  return contrast(parseColor(a), parseColor(b))
}

/* ------------------------------------------------------------------ */
/* color math                                                          */
/* ------------------------------------------------------------------ */

type Rgb = [number, number, number]
type Oklch = [number, number, number]

function pickOn(fill: Rgb, white: Rgb, ink: Rgb): Rgb | undefined {
  const toWhite = contrast(fill, white)
  const toInk = contrast(fill, ink)
  if (Math.max(toWhite, toInk) < TEXT_CONTRAST) return undefined
  // prefer white text, the way the built-in tones do, unless ink is clearly better
  return toWhite >= TEXT_CONTRAST ? white : ink
}

/** Step lightness in `direction` until `ok` holds (or the end of the range). */
function adjust(color: Oklch, direction: 1 | -1, ok: (rgb: Rgb) => boolean): Oklch {
  const [l, c, h] = color
  for (let next = l; next >= 0 && next <= 1; next += direction * 0.005) {
    const candidate: Oklch = [next, c, h]
    if (ok(fromOklch(candidate))) return candidate
  }
  return [direction > 0 ? 1 : 0, 0, h]
}

function contrast(a: Rgb, b: Rgb): number {
  const hi = Math.max(luminance(a), luminance(b))
  const lo = Math.min(luminance(a), luminance(b))
  return (hi + 0.05) / (lo + 0.05)
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function gamma(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
}

/** Parse `#rgb`, `#rrggbb` or `rgb(r g b)` / `rgb(r, g, b)` into 0–1 channels. */
export function parseColor(value: string): Rgb {
  const input = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(input)
  if (hex) {
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map((d) => d + d).join('') : hex[1]!
    return [0, 2, 4].map((i) => Number.parseInt(digits.slice(i, i + 2), 16) / 255) as Rgb
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(input)
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Number(n) / 255) as Rgb
  throw new Error(`[@dou-ui/theme] unsupported color "${value}": use #rrggbb or rgb()`)
}

function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

function toOklab(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(linear) as Rgb
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function toOklch(rgb: Rgb): Oklch {
  const [L, A, B] = toOklab(rgb)
  return [L, Math.hypot(A, B), Math.atan2(B, A)]
}

/** OKLCH back to sRGB, lowering chroma until the color fits the gamut. */
function fromOklch([L, C, h]: Oklch): Rgb {
  for (let chroma = C; ; chroma = Math.max(0, chroma - 0.002)) {
    const rgb = oklabToRgb(L, chroma * Math.cos(h), chroma * Math.sin(h))
    if (chroma === 0 || rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) {
      // snap to 8-bit channels, so every check sees the color that ends up in CSS
      return rgb.map((v) => Math.round(Math.min(1, Math.max(0, v || 0)) * 255) / 255) as Rgb
    }
  }
}

function oklabToRgb(L: number, A: number, B: number): Rgb {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/**
 * `amount` (0–1) of `color` mixed into `base` in OKLab, as CSS
 * `color-mix(in oklab, color amount, base)` does, as `#rrggbb`.
 */
export function mixColors(color: string, base: string, amount: number): string {
  const a = toOklab(parseColor(color))
  const b = toOklab(parseColor(base))
  const t = Math.min(1, Math.max(0, amount))
  const [L, A, B] = a.map((v, i) => v * t + b[i]! * (1 - t)) as [number, number, number]
  return toHex(oklabToRgb(L, A, B))
}
