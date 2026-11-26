import type { Tone } from 'dou-ui'
import type { FlowMessages } from '../locale'

/**
 * The built-in whiteboard palette names; their values follow the light or dark
 * color mode for readable contrast on the board.
 */
export const whiteboardColors = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const

export type WhiteboardPaletteColor = (typeof whiteboardColors)[number]

/**
 * A color on the whiteboard: a palette name (adapts to light and dark mode),
 * a DouUI `Tone`, or any CSS color string (such as `#3b6ea8` or `rgba(...)`).
 */
export type WhiteboardColor = WhiteboardPaletteColor | Tone | (string & {})

/** A background fill color, or `'none'` / `'transparent'` for a transparent fill. */
export type WhiteboardFill = WhiteboardColor | 'none' | 'transparent'

/** A border color, or `'none'` (or `'transparent'`) for a borderless shape. */
export type WhiteboardStroke = WhiteboardColor | 'none'

const TONES: readonly Tone[] = ['neutral', 'primary', 'success', 'warning', 'danger']

export const isWhiteboardColor = (value: unknown): value is WhiteboardPaletteColor =>
  typeof value === 'string' && (whiteboardColors as readonly string[]).includes(value)

export const isToneColor = (value: unknown): value is Tone =>
  typeof value === 'string' && (TONES as readonly string[]).includes(value)

/** Whether a color value explicitly disables painting (`'none'` or `'transparent'`). */
export const isNoneColor = (value: unknown): boolean =>
  typeof value === 'string' && /^(none|transparent)$/i.test(value.trim())

/** Trims a color value; maps `'none'` / `'transparent'` to `'none'`, empty strings to `undefined`. */
export function normalizeColorValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return isNoneColor(trimmed) ? 'none' : trimmed
}

/**
 * Turns a fill color into a CSS / SVG paint value.
 * Returns `'none'` for transparent fills (use `'transparent'` for CSS `background-color`).
 */
export function resolveFillColor(
  value: WhiteboardFill | undefined,
  kind: 'shape' | 'sticky' = 'shape',
): string | undefined {
  const color = normalizeColorValue(value)
  if (!color) return undefined
  if (color === 'none') return 'none'
  if (isWhiteboardColor(color)) return `var(--dou-whiteboard-fill-${color})`
  if (isToneColor(color)) {
    if (kind === 'sticky')
      return `color-mix(in oklab, var(--dou-color-${color}) 20%, var(--dou-color-bg-surface))`
    if (color === 'neutral') return 'var(--dou-color-bg-surface)'
    return `color-mix(in oklab, var(--dou-color-${color}) 10%, var(--dou-color-bg-surface))`
  }
  return color
}

/** Turns a border, connector or ink color into a CSS / SVG stroke/fill paint value. */
export function resolveStrokeColor(value: WhiteboardStroke | undefined): string | undefined {
  const color = normalizeColorValue(value)
  if (!color) return undefined
  if (color === 'none') return 'none'
  if (isWhiteboardColor(color)) return `var(--dou-whiteboard-color-${color})`
  if (isToneColor(color))
    return color === 'neutral' ? 'var(--dou-flow-whiteboard-ink)' : `var(--dou-color-${color})`
  return color
}

/** Turns a text color into a CSS / SVG color value. */
export function resolveTextColor(value: WhiteboardColor | undefined): string | undefined {
  const color = normalizeColorValue(value)
  if (!color || color === 'none') return undefined
  if (isWhiteboardColor(color)) return `var(--dou-whiteboard-color-${color})`
  if (isToneColor(color))
    return color === 'neutral' ? 'var(--dou-color-text)' : `var(--dou-color-${color}-text)`
  return color
}

/** Human-readable name for a color value in tooltips and screen-reader announcements. */
export function colorDisplayName(
  value: string | null | undefined,
  t: FlowMessages['board'],
  noneLabel?: string,
): string {
  if (value === null) return t.mixed
  if (value === undefined) return t.colorDefault
  if (value === 'none') return noneLabel ?? t.borderNone
  if (isWhiteboardColor(value)) return t.colors[value]
  if (isToneColor(value)) return t.tones[value]
  return value
}
