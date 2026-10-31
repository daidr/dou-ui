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

const SRGB = /^(#|rgba?\()/

/**
 * A computed color as `#rrggbb` or `rgba(…)`, which every SVG reader
 * understands. A canvas converts most colors as it parses them; colors
 * it keeps in another space (`oklab(…)`, `color(…)`) are painted on a
 * pixel and read back.
 */
export function plain(color: string) {
  if (SRGB.test(color)) return color
  if (normalizer === undefined)
    try {
      const sheet = document.createElement('canvas')
      sheet.width = sheet.height = 1
      normalizer = sheet.getContext('2d', { willReadFrequently: true })
    } catch {
      normalizer = null
    }
  if (!normalizer) return color
  normalizer.fillStyle = '#000'
  normalizer.fillStyle = color
  const parsed = String(normalizer.fillStyle)
  if (SRGB.test(parsed)) return parsed
  normalizer.clearRect(0, 0, 1, 1)
  normalizer.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = normalizer.getImageData(0, 0, 1, 1).data
  if (a === 255) return `#${[r, g, b].map((n) => n!.toString(16).padStart(2, '0')).join('')}`
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a! / 255) * 1000) / 1000})`
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
