import type { Tone } from 'dou-ui'

export type BarTone = Tone | 'default' | 'critical'

export interface BarColors {
  fill: string
  stroke: string
  progress: string
}

/** The chart's colors and font, read from the page, for drawing it elsewhere. */
export interface ExportTheme {
  fontFamily: string
  /** Size of the header, bar and cell text, in px. */
  fontSize: number
  fontWeight: string
  surface: string
  headerBg: string
  line: string
  lineStrong: string
  off: string
  text: string
  textSecondary: string
  textTertiary: string
  today: string
  link: string
  linkCritical: string
  linkBroken: string
  baseline: string
  bar: Record<BarTone, BarColors>
  summary: Record<BarTone, string>
  milestone: Record<BarTone, { fill: string; stroke: string }>
  marker: Record<Tone, { line: string; text: string }>
}

const TONES: BarTone[] = [
  'default',
  'neutral',
  'primary',
  'success',
  'warning',
  'danger',
  'critical',
]
const MARKER_TONES: Tone[] = ['neutral', 'primary', 'success', 'warning', 'danger']

const style = (el: Element) => getComputedStyle(el)

let normalizer: CanvasRenderingContext2D | null | undefined

/**
 * A computed color as `#rrggbb` or `rgba(…)`, which every SVG reader
 * understands; mixes in other color spaces are converted by a canvas.
 */
function plain(color: string) {
  if (normalizer === undefined)
    try {
      normalizer = document.createElement('canvas').getContext('2d')
    } catch {
      normalizer = null
    }
  if (!normalizer) return color
  normalizer.fillStyle = '#000'
  normalizer.fillStyle = color
  return String(normalizer.fillStyle)
}

/**
 * Reads the colors from elements made like the chart's own, inside `root`
 * so its theme and tokens apply, and removes them after.
 */
export function readTheme(root: HTMLElement): ExportTheme {
  const box = document.createElement('div')
  box.setAttribute('aria-hidden', 'true')
  box.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:0;left:0'
  root.append(box)
  const make = (className: string, parent: HTMLElement = box) => {
    const el = document.createElement('div')
    el.className = className
    parent.append(el)
    return el
  }
  /** A color written with the chart's variables, as computed. */
  const resolve = (value: string) => {
    const el = make('')
    el.style.color = value
    return plain(style(el).color)
  }
  try {
    const rootStyle = style(root)
    const bar = {} as Record<BarTone, BarColors>
    const summary = {} as Record<BarTone, string>
    const milestone = {} as Record<BarTone, { fill: string; stroke: string }>
    for (const tone of TONES) {
      const toneClass = tone === 'default' ? '' : ` is-${tone}`
      const el = make(`dou-gantt__bar${toneClass}`)
      const progress = make('dou-gantt__progress', el)
      bar[tone] = {
        fill: plain(style(el).backgroundColor),
        stroke: plain(style(el).borderTopColor),
        progress: plain(style(progress).backgroundColor),
      }
      summary[tone] = plain(style(make(`dou-gantt__bar is-summary${toneClass}`)).backgroundColor)
      const diamond = style(make(`dou-gantt__bar is-milestone${toneClass}`))
      milestone[tone] = {
        fill: plain(diamond.backgroundColor),
        stroke: plain(diamond.borderTopColor),
      }
    }
    const marker = {} as Record<Tone, { line: string; text: string }>
    for (const tone of MARKER_TONES) {
      const el = style(make(`dou-gantt__marker-label is-${tone}`))
      marker[tone] = {
        line: resolve(el.getPropertyValue('--dou-gantt-marker')),
        text: resolve(el.getPropertyValue('--dou-gantt-marker-text')),
      }
    }
    const header = style(make('dou-gantt__header'))
    const baseline = style(make('dou-gantt__baseline'))
    return {
      fontFamily: rootStyle.fontFamily,
      fontSize: Number.parseFloat(header.fontSize) || 13,
      fontWeight: rootStyle.getPropertyValue('--dou-font-weight-medium').trim() || '500',
      surface: plain(rootStyle.backgroundColor),
      headerBg: plain(header.backgroundColor),
      line: resolve('var(--dou-gantt-line)'),
      lineStrong: resolve('var(--dou-gantt-line-strong)'),
      off: resolve('var(--dou-gantt-off)'),
      text: resolve('var(--dou-color-text)'),
      textSecondary: resolve('var(--dou-color-text-secondary)'),
      textTertiary: resolve('var(--dou-color-text-tertiary)'),
      today: resolve('var(--dou-gantt-today)'),
      link: resolve('var(--dou-gantt-link)'),
      linkCritical: plain(style(make('dou-gantt__link is-critical')).color),
      linkBroken: plain(style(make('dou-gantt__link is-broken')).color),
      baseline: plain(baseline.backgroundColor),
      bar,
      summary,
      milestone,
      marker,
    }
  } finally {
    box.remove()
  }
}
