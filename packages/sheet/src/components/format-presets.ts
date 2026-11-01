import type { Tone } from 'dou-ui'
import { barColor, fillColor } from '../core/conditional'
import type { SheetColor, SheetConditionalFormat, SheetStyle } from '../core/model'
import type { SheetMessages } from '../locale'

/*
 * What the toolbar's menus and the conditional format dialogs offer: the
 * looks, scales and bar colors, and how a sample of each is drawn.
 */

export const TONES: Tone[] = ['neutral', 'primary', 'success', 'warning', 'danger']

export type SheetLookName = keyof SheetMessages['formats']['looks']

export const LOOKS: Record<SheetLookName, SheetStyle> = {
  danger: { fill: 'danger', tone: 'danger' },
  warning: { fill: 'warning', tone: 'warning' },
  success: { fill: 'success', tone: 'success' },
  dangerText: { tone: 'danger' },
  bold: { bold: true },
  neutral: { fill: 'neutral' },
}

export type SheetScaleName = keyof SheetMessages['formats']['scales']
export type SheetScaleColors = [SheetColor, SheetColor] | [SheetColor, SheetColor, SheetColor]

export const SCALES: Record<SheetScaleName, SheetScaleColors> = {
  rag: ['danger', 'warning', 'success'],
  gar: ['success', 'warning', 'danger'],
  diverging: ['danger', 'neutral', 'success'],
  blue: ['neutral', 'primary'],
}

/** The message key of a tone's name. */
export const toneKey = (tone: Tone) =>
  `tone${tone[0]!.toUpperCase()}${tone.slice(1)}` as `tone${Capitalize<Tone>}`

export const scaleSwatch = (colors: readonly SheetColor[]) =>
  `linear-gradient(to right, ${colors.map(fillColor).join(', ')})`
/** A data bar color as a chip; it fills its box so it sits centered like the scale swatches. */
export const barSwatch = (color: SheetColor) =>
  `linear-gradient(${barColor(color)}, ${barColor(color)})`

/** Whether two styles set the same parts the same way. */
export function sameStyle(a: SheetStyle, b: SheetStyle) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof SheetStyle>
  for (const key of keys) if ((a[key] ?? undefined) !== (b[key] ?? undefined)) return false
  return true
}

/** The preset a style is, if any. */
export function lookName(style: SheetStyle): SheetLookName | undefined {
  return (Object.keys(LOOKS) as SheetLookName[]).find((name) => sameStyle(LOOKS[name], style))
}

/** The preset some scale colors are, if any. */
export function scaleName(colors: readonly SheetColor[]): SheetScaleName | undefined {
  return (Object.keys(SCALES) as SheetScaleName[]).find(
    (name) =>
      SCALES[name].length === colors.length && SCALES[name].every((c, i) => c === colors[i]),
  )
}

/** How a sample `123` of a look shows: its classes and inline style. */
export function styleSample(style: SheetStyle | undefined): { cls: string[]; css: string } {
  if (!style) return { cls: [], css: '' }
  let css = ''
  if (style.color) css += `color:${style.color};`
  if (style.background) css += `background-color:${style.background};`
  return {
    cls: [
      !style.color && style.tone ? `is-tone-${style.tone}` : '',
      !style.background && style.fill ? `is-fill-${style.fill}` : '',
      style.bold ? 'is-bold' : '',
      style.italic ? 'is-italic' : '',
    ].filter(Boolean),
    css,
  }
}

/** How the sample of a format shows. */
export function formatSample(
  f: SheetConditionalFormat,
  styles: Record<string, SheetStyle> | undefined,
): { cls: string[]; css: string } {
  if ('scale' in f) return { cls: [], css: `background-image:${scaleSwatch(f.scale)}` }
  if ('bar' in f) {
    // like the bar on a cell: from the start, behind the number
    const color = barColor(f.bar === true ? 'neutral' : f.bar)
    return {
      cls: ['is-cell-bar'],
      css: `background-image:linear-gradient(to right, ${color} 70%, transparent 70%)`,
    }
  }
  return styleSample(typeof f.style === 'string' ? styles?.[f.style] : f.style)
}
