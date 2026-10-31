import type { Tone } from 'dou-ui'
import { offTime, type WorkCalendar } from '../core/calendar'
import { arrowPath, roundedPath, routeLink, type BarBox } from '../core/geometry'
import type { GanttLink, TaskSpan } from '../core/model'
import { hourStep, levelOf, nextUnit, unitStart, unitsBetween } from '../core/scale'
import { dayIndex } from '../core/time'
import type { GanttRow } from '../core/tree'
import { markerRoom, unitLabel } from '../labels'
import type { GanttMessages } from '../locale'
import type { GanttBarLabel } from '../types'
import type { BarTone, ExportTheme } from './theme'

/** Height of the time header, in px, as on screen. */
export const HEADER = 56
const TIER = 28
const BAR = 20
const MILESTONE = 7
/** How far bars move up when a baseline is drawn under them, in px. */
const BASELINE_SHIFT = 4
/** More room before a side title where a link leaves the bar's end, in px. */
export const LINKED_END_ROOM = 14

export interface ExportColumn {
  title: string
  width: number
  align: 'start' | 'center' | 'end'
  /** The title column: indented by depth, summaries in medium weight. */
  isTitle: boolean
  text: (row: GanttRow) => string
}

export interface DrawInput {
  /** The rows to draw, top to bottom. */
  rows: readonly GanttRow[]
  links: readonly GanttLink[]
  /** Columns of the table; none to leave the table out. */
  columns: readonly ExportColumn[]
  rowHeight: number
  dayWidth: number
  /** The time drawn, in minutes. */
  start: number
  end: number
  calendar: WorkCalendar
  messages: GanttMessages
  weekStart: 0 | 1
  /** The current time, or `null` to leave the today line out. */
  now: number | null
  markers: readonly { at: number; label?: string; tone?: Tone }[]
  critical: { tasks: ReadonlySet<string>; links: ReadonlySet<string> } | null
  broken: ReadonlySet<string>
  baseline: ReadonlyMap<string, TaskSpan> | null
  barLabel: GanttBarLabel
  /** Tasks with a link at their end, whose side titles start further out. */
  linkedEnds: ReadonlySet<string>
  /** Width of a text in px, at the given weight. */
  textWidth: (text: string, bold?: boolean) => number
}

/** The chart drawn as SVG markup, in two parts so the header can repeat on every printed page. */
export interface GanttDrawing {
  width: number
  /** Height of the rows, below the header. */
  bodyHeight: number
  header: string
  body: string
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const round = (value: number) => Math.round(value * 100) / 100

/** Cuts a text to fit `max` px, with an ellipsis. */
function fit(text: string, max: number, measure: (text: string) => number) {
  if (max <= 0) return ''
  if (measure(text) <= max) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (measure(`${text.slice(0, mid)}…`) <= max) lo = mid
    else hi = mid - 1
  }
  return lo ? `${text.slice(0, lo)}…` : ''
}

/** The time the content covers, widened to whole header cells with one more on either side. */
export function paddedRange(start: number, end: number, dayWidth: number, weekStart: 0 | 1) {
  const level = levelOf(dayWidth)
  const step = level.bottom === 'hour' ? hourStep(dayWidth) : 1
  const first = unitStart(level.bottom, start, weekStart, step)
  const before = unitStart(level.bottom, first - 1, weekStart, step)
  let after = unitStart(level.bottom, end, weekStart, step)
  if (after < end) after = nextUnit(level.bottom, after, step)
  return { start: before, end: nextUnit(level.bottom, after, step) }
}

export function drawGantt(input: DrawInput, theme: ExportTheme): GanttDrawing {
  const { rowHeight: rh, start, end, messages: m } = input
  const ppm = input.dayWidth / (24 * 60)
  const tableWidth = input.columns.reduce((sum, column) => sum + column.width, 0)
  const chartWidth = Math.ceil((end - start) * ppm)
  const width = tableWidth + chartWidth
  const bodyHeight = input.rows.length * rh
  const xOf = (at: number) => round(tableWidth + (at - start) * ppm)
  const shift = input.baseline ? BASELINE_SHIFT : 0
  const level = levelOf(input.dayWidth)
  const step = level.bottom === 'hour' ? hourStep(input.dayWidth) : 1
  const font = (size = theme.fontSize, bold = false) =>
    `font-size="${size}"${bold ? ` font-weight="${theme.fontWeight}"` : ''}`
  const measure = (bold: boolean) => (text: string) => input.textWidth(text, bold)
  const text = (x: number, y: number, value: string, attrs: string) =>
    value
      ? `<text x="${round(x)}" y="${round(y)}" dominant-baseline="central" ${attrs}>${escape(value)}</text>`
      : ''

  // Header -----------------------------------------------------------------------------
  const header: string[] = [`<rect width="${width}" height="${HEADER}" fill="${theme.headerBg}"/>`]
  input.columns.reduce((left, column) => {
    const label = fit(column.title, column.width - 24, measure(false))
    const x =
      column.align === 'center'
        ? left + column.width / 2
        : column.align === 'end'
          ? left + column.width - 12
          : left + 12
    const anchor = column.align === 'center' ? 'middle' : column.align === 'end' ? 'end' : 'start'
    header.push(
      text(x, HEADER / 2, label, `${font()} fill="${theme.textSecondary}" text-anchor="${anchor}"`),
    )
    return left + column.width
  }, 0)
  const top = unitsBetween(level.top, start, end, input.weekStart)
  for (const cell of top) {
    const left = Math.max(xOf(cell.start), tableWidth)
    const right = Math.min(xOf(cell.end), width)
    if (cell.start > start)
      header.push(
        `<rect x="${xOf(cell.start)}" y="0" width="1" height="${TIER}" fill="${theme.line}"/>`,
      )
    // labels stay in view, as they stick on screen
    const label = fit(
      unitLabel(level.top, cell.start, m, input.dayWidth),
      right - left - 16,
      measure(true),
    )
    header.push(
      text(left + 8, TIER / 2, label, `${font(theme.fontSize, true)} fill="${theme.text}"`),
    )
  }
  header.push(
    `<rect x="${tableWidth}" y="${TIER - 1}" width="${chartWidth}" height="1" fill="${theme.line}"/>`,
  )
  const bottom = unitsBetween(level.bottom, start, end, input.weekStart, step)
  for (const cell of bottom) {
    const left = xOf(cell.start)
    const cellWidth = (cell.end - cell.start) * ppm
    if (cell.start > start)
      header.push(
        `<rect x="${left}" y="${TIER}" width="1" height="${HEADER - TIER}" fill="${theme.line}"/>`,
      )
    const isNow = input.now != null && input.now >= cell.start && input.now < cell.end
    const off = level.bottom === 'day' && !input.calendar.isWorkday(dayIndex(cell.start))
    const color = isNow ? theme.today : off ? theme.textTertiary : theme.textSecondary
    const label = fit(
      unitLabel(level.bottom, cell.start, m, input.dayWidth),
      cellWidth - 8,
      measure(isNow),
    )
    header.push(
      text(
        left + cellWidth / 2,
        TIER + (HEADER - TIER) / 2,
        label,
        `${font(theme.fontSize, isNow)} fill="${color}" text-anchor="middle"`,
      ),
    )
  }
  const shownMarkers = input.markers.filter(
    (marker) => marker.label && marker.at >= start && marker.at <= end,
  )
  const markerRooms = markerRoom(shownMarkers.map((marker) => xOf(marker.at)))
  for (const [i, marker] of shownMarkers.entries()) {
    const room = markerRooms[i]!
    if (!room) continue
    const tone = theme.marker[marker.tone ?? 'neutral']
    // cut short before the next label, as on screen
    const label = fit(marker.label!, room - 14, measure(false))
    if (!label) continue
    const w = Math.ceil(input.textWidth(label)) + 12
    const x = xOf(marker.at)
    header.push(
      `<rect x="${x + 0.5}" y="5.5" width="${w}" height="17" rx="4" fill="${theme.headerBg}" stroke="${tone.line}" stroke-opacity="0.4"/>`,
      text(x + 6.5, 14, label, `font-size="12" fill="${tone.text}"`),
    )
  }
  if (tableWidth)
    header.push(
      `<rect x="${tableWidth - 1}" y="0" width="1" height="${HEADER}" fill="${theme.lineStrong}"/>`,
    )
  header.push(
    `<rect x="0" y="${HEADER - 1}" width="${width}" height="1" fill="${theme.lineStrong}"/>`,
  )

  // Body -------------------------------------------------------------------------------
  const body: string[] = [`<rect width="${width}" height="${bodyHeight}" fill="${theme.surface}"/>`]
  if (input.dayWidth >= 8)
    for (const range of offTime(input.calendar, start, end, level.name === 'hour'))
      body.push(
        `<rect x="${xOf(range.start)}" y="0" width="${round((range.end - range.start) * ppm)}" height="${bodyHeight}" fill="${theme.off}"/>`,
      )
  for (const cell of bottom)
    if (cell.start > start)
      body.push(
        `<rect x="${xOf(cell.start)}" y="0" width="1" height="${bodyHeight}" fill="${theme.line}"/>`,
      )
  input.rows.forEach((_, i) =>
    body.push(
      `<rect x="0" y="${(i + 1) * rh - 1}" width="${width}" height="1" fill="${theme.line}"/>`,
    ),
  )
  if (tableWidth)
    body.push(
      `<rect x="${tableWidth - 1}" y="0" width="1" height="${bodyHeight}" fill="${theme.lineStrong}"/>`,
    )

  // the table's cells
  input.rows.forEach((row, i) => {
    let left = 0
    for (const column of input.columns) {
      const indent = column.isTitle ? row.depth * 16 : 0
      const bold = column.isTitle && row.summary
      const room = column.width - 24 - indent
      const value = fit(column.text(row), room, measure(bold))
      const x =
        column.align === 'center'
          ? left + column.width / 2
          : column.align === 'end'
            ? left + column.width - 12
            : left + 12 + indent
      const anchor = column.align === 'center' ? 'middle' : column.align === 'end' ? 'end' : 'start'
      const color = column.isTitle ? theme.text : theme.textSecondary
      body.push(
        text(
          x,
          i * rh + rh / 2,
          value,
          `${font(theme.fontSize, bold)} fill="${color}" text-anchor="${anchor}"`,
        ),
      )
      left += column.width
    }
  })

  const now = input.now
  if (now != null && now >= start && now <= end)
    body.push(
      `<rect x="${xOf(now)}" y="0" width="1" height="${bodyHeight}" fill="${theme.today}"/>`,
    )
  for (const marker of input.markers)
    if (marker.at >= start && marker.at <= end)
      body.push(
        `<line x1="${xOf(marker.at) + 0.5}" y1="0" x2="${xOf(marker.at) + 0.5}" y2="${bodyHeight}" stroke="${theme.marker[marker.tone ?? 'neutral'].line}" stroke-dasharray="4 4"/>`,
      )

  // baselines
  if (input.baseline)
    input.rows.forEach((row, i) => {
      const plan = input.baseline!.get(row.task.id)
      if (!plan) return
      const y = i * rh + (rh + BAR) / 2 - 2
      if (row.milestone) {
        const cx = xOf(plan.start)
        body.push(
          `<rect x="${cx - 4}" y="${y - 2}" width="8" height="8" rx="1" fill="${theme.baseline}" transform="rotate(45 ${cx} ${y + 2})"/>`,
        )
      } else
        body.push(
          `<rect x="${xOf(plan.start)}" y="${y}" width="${round(Math.max(2, (plan.end - plan.start) * ppm))}" height="4" rx="2" fill="${theme.baseline}"/>`,
        )
    })

  // links, under the bars
  const index = new Map(input.rows.map((row, i) => [row.task.id, i]))
  const boxOf = (row: GanttRow, i: number): BarBox | null => {
    if (!row.span) return null
    const y = i * rh + rh / 2 - shift
    const left = xOf(row.span.start)
    if (row.milestone) return { left: left - MILESTONE, right: left + MILESTONE, y }
    return { left, right: left + Math.max(2, (row.span.end - row.span.start) * ppm), y }
  }
  for (const link of input.links) {
    const a = index.get(link.from)
    const b = index.get(link.to)
    if (a == null || b == null || a === b) continue
    const boxA = boxOf(input.rows[a]!, a)
    const boxB = boxOf(input.rows[b]!, b)
    if (!boxA || !boxB) continue
    const route = routeLink(boxA, boxB, link.type, rh)
    const broken = input.broken.has(link.id)
    const color = broken
      ? theme.linkBroken
      : input.critical?.links.has(link.id)
        ? theme.linkCritical
        : theme.link
    body.push(
      `<path d="${roundedPath(route.points)}" fill="none" stroke="${color}"${broken ? ' stroke-dasharray="4 3"' : ''}/>`,
      `<path d="${arrowPath(route.tip, route.direction)}" fill="${color}"/>`,
    )
  }

  // bars
  let clips = 0
  input.rows.forEach((row, i) => {
    const span = row.span
    if (!span || span.end < start || span.start > end) return
    const critical = input.critical?.tasks.has(row.task.id)
    const tone: BarTone = critical ? 'critical' : (row.task.tone ?? 'default')
    const left = xOf(span.start)
    const w = Math.max(row.milestone ? 0 : 2, (span.end - span.start) * ppm)
    const mid = i * rh + rh / 2 - shift
    const side = (x: number) => {
      if (input.barLabel === 'none') return
      const room = input.linkedEnds.has(row.task.id) ? LINKED_END_ROOM : 0
      body.push(text(x + room, mid, row.task.title, `${font()} fill="${theme.textSecondary}"`))
    }
    if (row.milestone) {
      const colors = theme.milestone[tone]
      body.push(
        `<rect x="${left - 5 + 0.5}" y="${mid - 5 + 0.5}" width="9" height="9" rx="2" fill="${colors.fill}" stroke="${colors.stroke}" transform="rotate(45 ${left} ${mid})"/>`,
      )
      side(left + 12)
      return
    }
    if (row.summary) {
      const color = theme.summary[tone]
      const y = mid - 6
      body.push(
        `<path d="M${left} ${y + 2} Q${left} ${y} ${left + 2} ${y} L${left + w - 2} ${y} Q${left + w} ${y} ${left + w} ${y + 2} L${left + w} ${y + 11} L${left + w - 6} ${y + 6} L${left + 6} ${y + 6} L${left} ${y + 11} Z" fill="${color}"/>`,
      )
      side(left + w + 8)
      return
    }
    const colors = theme.bar[tone]
    const y = mid - BAR / 2
    const id = `dou-gantt-bar-${clips++}`
    body.push(
      `<clipPath id="${id}"><rect x="${left}" y="${y}" width="${round(w)}" height="${BAR}" rx="6"/></clipPath>`,
    )
    body.push(
      `<rect x="${left + 0.5}" y="${y + 0.5}" width="${round(Math.max(1, w - 1))}" height="${BAR - 1}" rx="5.5" fill="${colors.fill}" stroke="${colors.stroke}"/>`,
    )
    if (row.progress > 0)
      body.push(
        `<rect x="${left}" y="${y}" width="${round(w * row.progress)}" height="${BAR}" fill="${colors.progress}" clip-path="url(#${id})"/>`,
      )
    const label = row.task.title
    const inside =
      input.barLabel === 'inside' || (input.barLabel === 'auto' && input.textWidth(label) + 20 <= w)
    if (inside) {
      // a long bar's title starts where the drawing does, as it sticks on screen
      const x = Math.max(left, tableWidth) + 8
      const shown = fit(label, left + w - x - 8, measure(false))
      body.push(text(x, mid, shown, `${font()} fill="${theme.text}"`))
    } else if (input.barLabel !== 'none') side(left + w + 8)
  })

  const fontAttrs = `font-family="${escape(theme.fontFamily)}"`
  return {
    width,
    bodyHeight,
    header: `<g ${fontAttrs}>${header.join('')}</g>`,
    body: `<g ${fontAttrs}>${body.join('')}</g>`,
  }
}

/**
 * A whole SVG document: the header, then the rows; `window` keeps only
 * some of the rows, for a printed page.
 */
export function svgDocument(drawing: GanttDrawing, window?: { top: number; height: number }) {
  const top = window?.top ?? 0
  const height = window?.height ?? drawing.bodyHeight
  const total = HEADER + height
  const clip = window
    ? `<clipPath id="dou-gantt-page-${top}"><rect x="0" y="${HEADER}" width="${drawing.width}" height="${height}"/></clipPath>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${drawing.width}" height="${total}" viewBox="0 0 ${drawing.width} ${total}">` +
    clip +
    `<g${window ? ` clip-path="url(#dou-gantt-page-${top})"` : ''}><g transform="translate(0 ${HEADER - top})">${drawing.body}</g></g>` +
    drawing.header +
    `</svg>`
  )
}
