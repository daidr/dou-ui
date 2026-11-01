/*
 * A sheet, or a page of it, drawn as SVG: fills, data bars, grid lines,
 * text and the built-in cell types' marks, the way the grid shows them.
 * Plain SVG that design programs read, without `foreignObject`.
 */

import type { Component } from 'vue'
import type { SheetDrawContext, SheetDrawRect, SheetDrawTextOptions } from '../core/cell-type'

/** The look of a cell's content, in plain colors. */
export interface DrawLook {
  color: string
  /** The fill, `null` for none. */
  background: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle' | 'bottom'
  wrap: boolean
  /** The cell's own grid line, where it isn't the sheet's, as on a fill. */
  line: string | null
}

/** A cell to draw, at its place among the lines drawn. */
export interface DrawCell {
  x: number
  y: number
  width: number
  height: number
  text: string
  look: DrawLook
  /** A conditional format's bar, as parts of the cell's width. */
  bar?: { from: number; to: number; color: string }
  /** A checkbox cell's box. */
  check?: boolean
  /** A merged cell, which hides the grid lines inside it. */
  merged?: boolean
  /** A select cell's value as a soft tag. */
  tag?: { background: string; color: string; border: string }
  /** A cell type's own drawing, as SVG markup in the cell's own coordinates. */
  draw?: (draw: SheetDrawContext) => string
}

/** The colors and font of the sheet, read from the page. */
export interface DrawTheme {
  fontFamily: string
  fontSize: number
  boldWeight: string
  surface: string
  line: string
  freezeLine: string
  headerBg: string
  headerText: string
  headerLine: string
  checkBorder: string
  checkBg: string
  checkOn: string
  checkOnBg: string
}

export interface SheetDrawing {
  /** The widths of the columns drawn, left to right. */
  colWidths: number[]
  /** The heights of the rows drawn, top to bottom. */
  rowHeights: number[]
  /** The column letters and row numbers, when the headers are drawn. */
  colNames?: string[]
  rowNames?: string[]
  headerWidth: number
  headerHeight: number
  /** How many of the rows and columns drawn are frozen, with a firmer line after them. */
  frozenRows: number
  frozenCols: number
  cells: DrawCell[]
  gridlines: boolean
  background: boolean
  theme: DrawTheme
  /** Icons as SVG, for cell types' drawings; none without it. */
  icon?: (icon: Component, box: SheetDrawRect, color: string) => string
  /** CSS colors as SVG takes them, for cell types' drawings; as they are without it. */
  color?: (value: string) => string
}

/** Measures text in a font, in px. */
export type MeasureText = (text: string, font: string) => number

const PAD = 8
const LINE_HEIGHT = 1.4

const XML_SPECIAL = /[&<>"]/
const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

export const escapeXML = (text: string) =>
  XML_SPECIAL.test(text) ? text.replace(/[&<>"]/g, (c) => XML_ESCAPES[c]!) : text

const n = (value: number) => String(Math.round(value * 100) / 100)

/**
 * Breaks text into lines no wider than `width`: at spaces where it can,
 * between any two characters of CJK text, and inside a word too long
 * for a line.
 */
export function wrapLines(text: string, width: number, measure: (text: string) => number) {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    // words with their space after, and each CJK character on its own
    const pieces = paragraph.match(/[⺀-鿿豈-﫿＀-￯]|[^\s⺀-鿿豈-﫿＀-￯]+\s*|\s+/g) ?? ['']
    let line = ''
    for (const piece of pieces) {
      const next = line + piece
      if (!line || measure(next.trimEnd()) <= width) {
        line = next
        continue
      }
      lines.push(line.trimEnd())
      line = piece.trimStart()
    }
    // a word wider than the line is cut where it fills it
    while (line && measure(line.trimEnd()) > width && line.length > 1) {
      let cut = line.length - 1
      while (cut > 1 && measure(line.slice(0, cut)) > width) cut--
      lines.push(line.slice(0, cut))
      line = line.slice(cut)
    }
    lines.push(line.trimEnd())
  }
  return lines
}

/** The sheet as an SVG document. */
/** The size of the image a drawing makes, in CSS px. */
export function drawingSize(drawing: SheetDrawing) {
  let width = drawing.headerWidth
  for (const w of drawing.colWidths) width += w
  let height = drawing.headerHeight
  for (const h of drawing.rowHeights) height += h
  return { width, height }
}

export function drawSheet(drawing: SheetDrawing, measure: MeasureText) {
  const { theme, colWidths, rowHeights, headerWidth: hx, headerHeight: hy } = drawing
  const xs = [hx]
  for (const w of colWidths) xs.push(xs[xs.length - 1]! + w)
  const ys = [hy]
  for (const h of rowHeights) ys.push(ys[ys.length - 1]! + h)
  const width = xs[xs.length - 1]!
  const height = ys[ys.length - 1]!
  const font = (bold: boolean, italic: boolean) =>
    `${italic ? 'italic ' : ''}${bold ? theme.boldWeight : '400'} ${theme.fontSize}px ${theme.fontFamily}`
  const out: string[] = []
  const defs: string[] = []
  let clips = 0

  if (drawing.background)
    out.push(`<rect width="${n(width)}" height="${n(height)}" fill="${theme.surface}"/>`)

  // fills and bars first, then the lines over them, then the text
  for (const cell of drawing.cells) {
    const x = hx + cell.x
    const y = hy + cell.y
    if (cell.look.background)
      out.push(
        `<rect x="${n(x)}" y="${n(y)}" width="${n(cell.width)}" height="${n(cell.height)}" fill="${cell.look.background}"/>`,
      )
    if (cell.bar) {
      const inner = cell.width - 6
      out.push(
        `<rect x="${n(x + 3 + inner * cell.bar.from)}" y="${n(y + 5)}" width="${n(Math.max(0, inner * (cell.bar.to - cell.bar.from)))}" height="${n(Math.max(0, cell.height - 10))}" fill="${cell.bar.color}"/>`,
      )
    }
  }

  const lines: string[] = []
  if (drawing.gridlines) {
    const covered = coveredEdges(drawing)
    for (let i = 1; i < xs.length; i++) {
      if (i === drawing.frozenCols) continue
      for (const [top, bottom] of openRuns(ys, covered.cols.get(i - 1)))
        lines.push(`M${n(xs[i]! - 0.5)} ${n(top)}V${n(bottom)}`)
    }
    for (let i = 1; i < ys.length; i++) {
      if (i === drawing.frozenRows) continue
      for (const [left, right] of openRuns(xs, covered.rows.get(i - 1)))
        lines.push(`M${n(left)} ${n(ys[i]! - 0.5)}H${n(right)}`)
    }
  }
  // the sheet's outer edges, which the headers draw in the grid
  if (drawing.gridlines && xs.length > 1 && ys.length > 1) {
    if (!hy) lines.push(`M${n(hx)} 0.5H${n(width)}`)
    if (!hx) lines.push(`M0.5 ${n(hy)}V${n(height)}`)
  }
  if (lines.length) out.push(`<path d="${lines.join('')}" stroke="${theme.line}" fill="none"/>`)
  // cells with their own line, such as filled ones, draw their right and bottom edges
  const own = new Map<string, string[]>()
  if (drawing.gridlines)
    for (const cell of drawing.cells) {
      const color = cell.look.line
      if (!color || color === theme.line) continue
      const right = hx + cell.x + cell.width - 0.5
      const bottom = hy + cell.y + cell.height - 0.5
      const path = `M${n(right)} ${n(hy + cell.y)}V${n(bottom + 0.5)}M${n(hx + cell.x)} ${n(bottom)}H${n(right)}`
      const list = own.get(color)
      if (list) list.push(path)
      else own.set(color, [path])
    }
  for (const [color, paths] of own)
    out.push(`<path d="${paths.join('')}" stroke="${color}" fill="none"/>`)
  const freeze: string[] = []
  if (drawing.frozenCols > 0 && drawing.frozenCols < xs.length)
    freeze.push(`M${n(xs[drawing.frozenCols]! - 0.5)} ${n(hy)}V${n(height)}`)
  if (drawing.frozenRows > 0 && drawing.frozenRows < ys.length)
    freeze.push(`M${n(hx)} ${n(ys[drawing.frozenRows]! - 0.5)}H${n(width)}`)
  if (freeze.length)
    out.push(`<path d="${freeze.join('')}" stroke="${theme.freezeLine}" fill="none"/>`)

  // the text, in a group with what most of it shares
  const text = mostCommon(drawing.cells.map((cell) => cell.look.color)) ?? theme.headerText
  const words: string[] = []
  for (const cell of drawing.cells) {
    const x = hx + cell.x
    const y = hy + cell.y
    const { look } = cell
    if (cell.draw) {
      const markup = cell.draw(drawContext(cell, drawing, measure))
      if (!markup) continue
      // in the cell's own coordinates, and kept to it as the grid keeps a cell's content
      const id = `c${clips++}`
      defs.push(
        `<clipPath id="${id}"><rect width="${n(cell.width)}" height="${n(cell.height)}"/></clipPath>`,
      )
      out.push(`<g transform="translate(${n(x)} ${n(y)})" clip-path="url(#${id})">${markup}</g>`)
      continue
    }
    if (cell.check !== undefined) {
      const size = 14
      const bx = alignX(look.align, x, cell.width, size)
      const by = alignY(look.valign, y, cell.height, size)
      out.push(
        `<rect x="${n(bx + 0.5)}" y="${n(by + 0.5)}" width="${size - 1}" height="${size - 1}" rx="3.5" fill="${cell.check ? theme.checkOnBg : theme.checkBg}" stroke="${cell.check ? theme.checkOnBg : theme.checkBorder}"/>`,
      )
      if (cell.check)
        out.push(
          `<path d="M${n(bx + 3.5)} ${n(by + 7.2)}l2.4 2.4 4.6-5" fill="none" stroke="${theme.checkOn}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
      continue
    }
    if (!cell.text) continue
    const f = font(look.bold, look.italic)
    const room = cell.width - PAD * 2
    const lineHeight = Math.round(theme.fontSize * LINE_HEIGHT)
    if (cell.tag) {
      const textWidth = Math.min(measure(cell.text, f), room - 12)
      const tagWidth = textWidth + 12
      const tagHeight = 20
      const tx = alignX(look.align, x, cell.width, tagWidth)
      const ty = alignY(look.valign, y, cell.height, tagHeight)
      const id = `c${clips++}`
      defs.push(
        `<clipPath id="${id}"><rect x="${n(tx + 6)}" y="${n(ty)}" width="${n(textWidth)}" height="${tagHeight}"/></clipPath>`,
      )
      out.push(
        `<rect x="${n(tx + 0.5)}" y="${n(ty + 0.5)}" width="${n(tagWidth - 1)}" height="${tagHeight - 1}" rx="3.5" fill="${cell.tag.background}" stroke="${cell.tag.border}"/>`,
        `<text x="${n(tx + 6)}" y="${n(ty + tagHeight / 2)}" dominant-baseline="central" fill="${cell.tag.color}" clip-path="url(#${id})"${textAttrs(look)}>${escapeXML(cell.text)}</text>`,
      )
      continue
    }
    const single = !look.wrap
    const texts = single ? [firstLine(cell.text)] : wrapLines(cell.text, room, (t) => measure(t, f))
    // text no wider than a full em a character fits without measuring it
    const widest =
      single && texts[0]!.length * theme.fontSize <= room
        ? 0
        : Math.max(...texts.map((t) => measure(t, f)))
    const blockHeight = texts.length * lineHeight
    const top = look.wrap
      ? y + 4
      : look.valign === 'top'
        ? y + 4
        : look.valign === 'bottom'
          ? y + cell.height - 4 - blockHeight
          : y + (cell.height - blockHeight) / 2
    const tx =
      look.align === 'center'
        ? x + cell.width / 2
        : look.align === 'right'
          ? x + cell.width - PAD
          : x + PAD
    let attrs = textAttrs(look)
    if (look.align !== 'left')
      attrs += ` text-anchor="${look.align === 'center' ? 'middle' : 'end'}"`
    if (look.color !== text) attrs += ` fill="${look.color}"`
    if (widest > room || blockHeight > cell.height - 8) {
      const id = `c${clips++}`
      defs.push(
        `<clipPath id="${id}"><rect x="${n(x + 1)}" y="${n(y)}" width="${n(Math.max(0, cell.width - 2))}" height="${n(cell.height - 1)}"/></clipPath>`,
      )
      attrs += ` clip-path="url(#${id})"`
    }
    if (texts.length === 1)
      words.push(
        `<text x="${n(tx)}" y="${n(top + lineHeight / 2)}"${attrs}>${escapeXML(texts[0]!)}</text>`,
      )
    else
      words.push(
        `<text${attrs}>${texts
          .map(
            (t, i) =>
              `<tspan x="${n(tx)}" y="${n(top + lineHeight * i + lineHeight / 2)}">${escapeXML(t)}</tspan>`,
          )
          .join('')}</text>`,
      )
  }
  if (words.length) out.push(`<g dominant-baseline="central" fill="${text}">${words.join('')}</g>`)

  if (drawing.colNames && hy > 0) {
    out.push(`<rect width="${n(width)}" height="${n(hy)}" fill="${theme.headerBg}"/>`)
    drawing.colNames.forEach((name, i) =>
      out.push(
        `<text x="${n((xs[i]! + xs[i + 1]!) / 2)}" y="${n(hy / 2)}" text-anchor="middle" dominant-baseline="central" fill="${theme.headerText}">${escapeXML(name)}</text>`,
      ),
    )
  }
  if (drawing.rowNames && hx > 0) {
    out.push(
      `<rect y="${n(hy)}" width="${n(hx)}" height="${n(height - hy)}" fill="${theme.headerBg}"/>`,
    )
    drawing.rowNames.forEach((name, i) =>
      out.push(
        `<text x="${n(hx / 2)}" y="${n((ys[i]! + ys[i + 1]!) / 2)}" text-anchor="middle" dominant-baseline="central" fill="${theme.headerText}">${escapeXML(name)}</text>`,
      ),
    )
  }
  if (hx > 0 || hy > 0) {
    const edges: string[] = []
    if (hy > 0) {
      edges.push(`M0 ${n(hy - 0.5)}H${n(width)}`)
      for (let i = 1; i < xs.length; i++) edges.push(`M${n(xs[i]! - 0.5)} 0V${n(hy)}`)
    }
    if (hx > 0) {
      edges.push(`M${n(hx - 0.5)} 0V${n(height)}`)
      for (let i = 1; i < ys.length; i++) edges.push(`M0 ${n(ys[i]! - 0.5)}H${n(hx)}`)
    }
    out.push(`<path d="${edges.join('')}" stroke="${theme.headerLine}" fill="none"/>`)
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}"` +
    ` font-family="${escapeXML(theme.fontFamily)}" font-size="${theme.fontSize}" xml:space="preserve">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    out.join('') +
    `</svg>`
  )
}

const firstLine = (text: string) => {
  const end = text.indexOf('\n')
  return end === -1 ? text : text.slice(0, end)
}

function mostCommon(list: string[]) {
  const counts = new Map<string, number>()
  let best: string | undefined
  let most = 0
  for (const item of list) {
    const count = (counts.get(item) ?? 0) + 1
    counts.set(item, count)
    if (count > most) {
      most = count
      best = item
    }
  }
  return best
}

/** What a cell type's `draw` gets for a cell. */
function drawContext(
  cell: DrawCell,
  drawing: SheetDrawing,
  measure: MeasureText,
): SheetDrawContext {
  const { theme } = drawing
  const look = {
    color: cell.look.color,
    background: cell.look.background,
    align: cell.look.align,
    valign: cell.look.valign,
    bold: cell.look.bold,
    italic: cell.look.italic,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
  }
  const text = (
    value: string,
    box: SheetDrawRect = { x: 0, y: 0, width: cell.width, height: cell.height },
    options: SheetDrawTextOptions = {},
  ) => {
    const line = firstLine(value)
    if (!line) return ''
    const align = options.align ?? look.align
    const valign = options.valign ?? look.valign
    const size = options.size ?? look.fontSize
    const bold = options.bold ?? look.bold
    const italic = options.italic ?? look.italic
    const width = measure(
      line,
      `${italic ? 'italic ' : ''}${bold ? theme.boldWeight : '400'} ${size}px ${theme.fontFamily}`,
    )
    const x = alignX(align, box.x, box.width, width)
    const y = alignY(valign, box.y, box.height, size * LINE_HEIGHT) + (size * LINE_HEIGHT) / 2
    let attrs = ` fill="${options.color ?? look.color}"`
    if (size !== theme.fontSize) attrs += ` font-size="${n(size)}"`
    if (bold) attrs += ` font-weight="bold"`
    if (italic) attrs += ` font-style="italic"`
    return `<text x="${n(x)}" y="${n(y)}" dominant-baseline="central"${attrs}>${escapeXML(line)}</text>`
  }
  return {
    width: cell.width,
    height: cell.height,
    formatted: cell.text,
    look,
    text,
    icon: drawing.icon ?? (() => ''),
    color: drawing.color ?? ((value) => value),
    escape: escapeXML,
  }
}

function textAttrs(look: DrawLook) {
  let attrs = ''
  if (look.bold) attrs += ` font-weight="bold"`
  if (look.italic) attrs += ` font-style="italic"`
  const deco = [look.underline && 'underline', look.strike && 'line-through'].filter(Boolean)
  if (deco.length) attrs += ` text-decoration="${deco.join(' ')}"`
  return attrs
}

const alignX = (align: DrawLook['align'], x: number, width: number, size: number) =>
  align === 'center' ? x + (width - size) / 2 : align === 'right' ? x + width - PAD - size : x + PAD

const alignY = (valign: DrawLook['valign'], y: number, height: number, size: number) =>
  valign === 'top' ? y + 4 : valign === 'bottom' ? y + height - 4 - size : y + (height - size) / 2

/** Where each line's far edge is, from the first line's near edge: offset → line after it. */
function edgesOf(sizes: number[]) {
  const at = new Map<number, number>([[0, 0]])
  let sum = 0
  sizes.forEach((size, i) => at.set((sum += size), i + 1))
  return at
}

/**
 * The grid lines a merge hides: for each column edge (after column `i`)
 * the runs of y it covers, and for each row edge the runs of x.
 */
function coveredEdges(drawing: SheetDrawing) {
  const cols = new Map<number, [number, number][]>()
  const rows = new Map<number, [number, number][]>()
  const merged = drawing.cells.filter((cell) => cell.merged)
  if (!merged.length) return { cols, rows }
  const xs = edgesOf(drawing.colWidths)
  const ys = edgesOf(drawing.rowHeights)
  for (const cell of merged) {
    const left = xs.get(cell.x)
    const top = ys.get(cell.y)
    const right = xs.get(cell.x + cell.width)
    const bottom = ys.get(cell.y + cell.height)
    if (left === undefined || top === undefined || right === undefined || bottom === undefined)
      continue
    for (let i = left + 1; i < right; i++)
      push(cols, i - 1, [
        drawing.headerHeight + cell.y,
        drawing.headerHeight + cell.y + cell.height,
      ])
    for (let i = top + 1; i < bottom; i++)
      push(rows, i - 1, [drawing.headerWidth + cell.x, drawing.headerWidth + cell.x + cell.width])
  }
  return { cols, rows }
}

function push(map: Map<number, [number, number][]>, key: number, run: [number, number]) {
  const list = map.get(key)
  if (list) list.push(run)
  else map.set(key, [run])
}

/** The parts of a line from the first to the last of `edges` not under any of `covered`. */
function openRuns(edges: number[], covered: [number, number][] | undefined): [number, number][] {
  const start = edges[0]!
  const end = edges[edges.length - 1]!
  if (!covered) return [[start, end]]
  const runs: [number, number][] = []
  let at = start
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  for (const [a, b] of [...covered].sort((p, q) => p[0] - q[0])) {
    if (a > at) runs.push([at, a])
    at = Math.max(at, b)
  }
  if (at < end) runs.push([at, end])
  return runs
}
