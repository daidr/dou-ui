import { svgToPNG } from 'dou-ui'
import type { SheetAxis } from '../core/axis'
import type { SheetBounds } from '../core/address'
import { boundsOf, columnName, parseRange } from '../core/address'
import { optionOf, type SheetCellType } from '../core/cell-type'
import { dataBounds } from '../core/csv'
import type { SheetMerges } from '../core/merge'
import type { SheetData, SheetTypeSetup } from '../core/model'
import { CellCheck, CellOption } from '../components/cell-renders'
import type { SheetRef } from '../core/transaction'
import type { SheetExportOptions, SheetImageOptions, SheetPrintOptions } from '../types'
import { plainColor } from './color'
import {
  drawSheet,
  drawingSize,
  escapeXML,
  type DrawCell,
  type DrawLook,
  type DrawTheme,
  type MeasureText,
  type SheetDrawing,
} from './draw'

/** A cell as the grid draws it, which images and pages draw the same way. */
export interface ExportCellView {
  text: string
  cls: string
  css: string
  render?: SheetCellType['render']
  props?: Record<string, unknown>
  label?: string
  hidden?: boolean
}

/** A sheet as images and pages draw it: its data, laid out, and its cells as the grid draws them. */
export interface SheetExportTarget {
  data: SheetData
  rows: SheetAxis
  cols: SheetAxis
  frozen: { rows: number; cols: number }
  merges: SheetMerges
  cellView: (
    row: number,
    col: number,
    line: SheetData['cells'][number],
    width: number,
    span?: SheetBounds,
  ) => ExportCellView
}

/** What of the grid images and pages are drawn from. */
export interface SheetExportSource {
  root: () => HTMLElement | undefined
  /** The sheet shown, or the one named. */
  target: (sheet?: SheetRef) => SheetExportTarget
  rowHeight: () => number
  gridlines: () => boolean
}

type ExportReader = ReturnType<typeof exportReader>

/** The lines from `from` to `to` that show: hidden ones and rows the filter hides are left out. */
function shownLines(axis: SheetAxis, from: number, to: number) {
  const list: number[] = []
  for (let i = from; i <= to; i++) if (axis.size(i) > 0) list.push(i)
  return list
}

const read = (el: Element) => getComputedStyle(el)

/** A fill as a plain color, `null` for none. */
function fillOf(value: string) {
  const plain = plainColor(value)
  return /^rgba\(.*,\s*0\)$/.test(plain) || value === 'transparent' ? null : plain
}

const sum = (list: number[], axis: SheetAxis) => list.reduce((total, i) => total + axis.size(i), 0)

const BAR_SPAN = /--dou-sheet-bar-(from|to):[^;]*;/g
const SELECTION_CLASSES = / is-(selected|active|edge-\w+|invalid|freeze-edge)\b/g

/**
 * Reads how cells look from cells made like the grid's own, in a sheet of
 * their own inside this one so its tokens apply, or in the light theme
 * for paper. `look` turns a cell's classes and style into plain colors.
 */
function exportReader(root: HTMLElement, light: boolean, gridlines: boolean) {
  const box = document.createElement('div')
  box.className = `dou-sheet${gridlines ? ' has-gridlines' : ''}`
  if (light) box.dataset.douTheme = 'light'
  box.setAttribute('aria-hidden', 'true')
  box.style.cssText =
    'position:absolute;top:0;left:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none'
  root.append(box)
  const make = (className: string, css = '') => {
    const el = document.createElement('div')
    el.className = className
    if (css) el.style.cssText = css
    box.append(el)
    return el
  }
  const color = (value: string) => {
    const el = make('')
    el.style.color = value
    return plainColor(read(el).color)
  }
  const cell = read(make('dou-sheet__cell'))
  const bold = read(make('dou-sheet__cell is-bold'))
  const colHead = read(make('dou-sheet__col-head'))
  const off = read(make('dou-sheet__check'))
  const on = read(make('dou-sheet__check is-checked'))
  const theme: DrawTheme = {
    fontFamily: cell.fontFamily,
    fontSize: Number.parseFloat(cell.fontSize) || 13,
    boldWeight: bold.fontWeight,
    surface: color('var(--dou-color-bg-surface)'),
    line: gridlines ? color('var(--dou-sheet-line)') : 'none',
    freezeLine: color('var(--dou-sheet-freeze-line)'),
    headerBg: color('var(--dou-sheet-header-bg)'),
    headerText: plainColor(colHead.color),
    headerLine: color('var(--dou-sheet-line-strong)'),
    checkBorder: plainColor(off.borderTopColor),
    checkBg: plainColor(off.backgroundColor),
    checkOn: plainColor(on.color),
    checkOnBg: plainColor(on.backgroundColor),
  }
  const looks = new Map<string, DrawLook & { barColor?: string }>()
  const look = (raw: string, css: string) => {
    const key = `${raw}\u0000${css}`
    let found = looks.get(key)
    if (found) return found
    // the selection isn't drawn
    const cls = ` ${raw}`.replace(SELECTION_CLASSES, '')
    const style = read(make(cls, css))
    const deco = style.textDecorationLine
    const has = (name: string) => cls.includes(` ${name}`)
    found = {
      color: plainColor(style.color),
      background: fillOf(style.backgroundColor),
      bold: Number.parseInt(style.fontWeight) >= 600,
      italic: style.fontStyle === 'italic',
      underline: deco.includes('underline'),
      strike: deco.includes('line-through'),
      align: has('is-align-center') ? 'center' : has('is-align-right') ? 'right' : 'left',
      valign: has('is-valign-top') ? 'top' : has('is-valign-bottom') ? 'bottom' : 'middle',
      wrap: has('is-wrap'),
      line: gridlines ? plainColor(style.borderRightColor) : null,
    }
    if (has('has-bar')) found.barColor = color(style.getPropertyValue('--dou-sheet-bar-color'))
    looks.set(key, found)
    return found
  }
  const tags = new Map<string, NonNullable<DrawCell['tag']>>()
  const tag = (tone: string | undefined) => {
    const key = tone ?? ''
    let found = tags.get(key)
    if (!found) {
      const cls = 'dou-tag dou-tag--soft dou-sheet__tag'
      const style = read(
        make(tone && tone !== 'neutral' ? `${cls} dou-tag--${tone}` : `${cls} is-neutral`),
      )
      found = {
        background: plainColor(style.backgroundColor),
        color: plainColor(style.color),
        border: plainColor(style.borderTopColor),
      }
      tags.set(key, found)
    }
    return found
  }
  return { theme, look, tag, done: () => box.remove() }
}

/** A select cell's option tone, or `undefined` when its value isn't one of the options. */
function optionTone(props: Record<string, unknown> | undefined) {
  const setup = props?.setup as SheetTypeSetup | undefined
  for (const option of setup?.options ?? []) {
    const picked = optionOf(option)
    if (picked.value === props!.value) return { tone: picked.tone }
  }
  return undefined
}

/** Wide enough for the longest row number drawn. */
const exportHeaderWidth = (rowList: number[]) =>
  Math.max(40, String((rowList[rowList.length - 1] ?? 0) + 1).length * 8 + 16)

let exportMeasure: CanvasRenderingContext2D | null | undefined
const measureText: MeasureText = (text, font) => {
  exportMeasure ??= document.createElement('canvas').getContext('2d')
  if (!exportMeasure) return text.length * 7
  if (exportMeasure.font !== font) exportMeasure.font = font
  return exportMeasure.measureText(text).width
}

/** A4 less 10mm margins, in px at 96 per inch: [width, height]. */
const PAGE = { portrait: [718, 1047], landscape: [1047, 718] } as const

/**
 * Runs of lines that fit `room` each, after the lines repeated on every
 * page. A line bigger than the room gets a page of its own.
 */
function pagesOf(list: number[], size: (i: number) => number, room: number) {
  const pages: number[][] = []
  let page: number[] = []
  let used = 0
  for (const i of list) {
    const s = size(i)
    if (page.length && used + s > room) {
      pages.push(page)
      page = []
      used = 0
    }
    page.push(i)
    used += s
  }
  if (page.length || !pages.length) pages.push(page)
  return pages
}

/** The cells an image or print shows: `range`, or the cells with data and the merges. */
function exportBounds(range: string | undefined, t: SheetExportTarget): SheetBounds {
  const lastRow = t.rows.count - 1
  const lastCol = t.cols.count - 1
  if (range != null) {
    const parsed = parseRange(range)
    if (!parsed) throw new RangeError(`"${range}" isn't a range`)
    const b = boundsOf(parsed)
    return {
      top: Math.max(0, b.top),
      left: Math.max(0, b.left),
      bottom: Math.min(lastRow, b.bottom),
      right: Math.min(lastCol, b.right),
    }
  }
  const b = dataBounds(t.data) ?? { top: 0, left: 0, bottom: 0, right: 0 }
  for (const m of t.merges.list) {
    b.bottom = Math.max(b.bottom, m.bottom)
    b.right = Math.max(b.right, m.right)
  }
  return {
    top: 0,
    left: 0,
    bottom: Math.min(lastRow, b.bottom),
    right: Math.min(lastCol, b.right),
  }
}
/** `exportSVG`, `exportPNG` and `print` of a grid. */
export function createSheetExport(src: SheetExportSource) {
  /** What to draw for some rows and columns, in this order, each list sorted. */
  function exportDrawing(
    rowList: number[],
    colList: number[],
    options: { headers: boolean; gridlines: boolean; background: boolean },
    reader: ExportReader,
    t: SheetExportTarget,
  ): SheetDrawing {
    const { rows: r, cols: c, merges, data } = t
    const rowAt = new Map(rowList.map((row, i) => [row, i]))
    const colAt = new Map(colList.map((col, i) => [col, i]))
    const ys = [0]
    for (const row of rowList) ys.push(ys[ys.length - 1]! + r.size(row))
    const xs = [0]
    for (const col of colList) xs.push(xs[xs.length - 1]! + c.size(col))
    const f = t.frozen
    const cells: DrawCell[] = []
    const add = (
      view: ExportCellView,
      x: number,
      y: number,
      width: number,
      height: number,
      merged = false,
    ) => {
      if (view.hidden) return
      const bar = view.cls.includes(' has-bar')
      // the bar's length is the cell's own; its color is the look's
      const look = reader.look(view.cls, bar ? view.css.replace(BAR_SPAN, '') : view.css)
      const cell: DrawCell = { x, y, width, height, text: view.text, look }
      if (merged) cell.merged = true
      if (bar && look.barColor) {
        const from =
          Number.parseFloat(/--dou-sheet-bar-from:([\d.]+)%/.exec(view.css)?.[1] ?? '0') / 100
        const to =
          Number.parseFloat(/--dou-sheet-bar-to:([\d.]+)%/.exec(view.css)?.[1] ?? '0') / 100
        cell.bar = { from, to, color: look.barColor }
      }
      if (view.render === CellCheck) cell.check = view.props?.value === true
      else if (view.render === CellOption) {
        const option = view.text ? optionTone(view.props) : undefined
        if (option) cell.tag = reader.tag(option.tone)
      } else if (view.render) cell.text = view.label ?? view.text
      if (!merged && !cell.text && !look.background && !cell.bar && cell.check === undefined) return
      cells.push(cell)
    }
    const seen = new Set<SheetBounds>()
    rowList.forEach((row, ri) => {
      const line = data.cells[row]
      colList.forEach((col, ci) => {
        const m = merges.size ? merges.at(row, col) : undefined
        if (!m)
          return add(
            t.cellView(row, col, line, c.size(col)),
            xs[ci]!,
            ys[ri]!,
            c.size(col),
            r.size(row),
          )
        if (seen.has(m)) return
        seen.add(m)
        // a merge from its first row and column drawn to its last
        let last = ri
        while (last + 1 < rowList.length && rowList[last + 1]! <= m.bottom) last++
        let right = ci
        while (right + 1 < colList.length && colList[right + 1]! <= m.right) right++
        const view = t.cellView(
          m.top,
          m.left,
          data.cells[m.top],
          c.offset(m.right + 1) - c.offset(m.left),
          m,
        )
        // its text shows where its top left cell is
        if (!rowAt.has(m.top) || !colAt.has(m.left)) {
          view.text = ''
          view.render = undefined
        }
        add(view, xs[ci]!, ys[ri]!, xs[right + 1]! - xs[ci]!, ys[last + 1]! - ys[ri]!, true)
      })
    })
    const frozenRows = rowList.filter((row) => row < f.rows).length
    const frozenCols = colList.filter((col) => col < f.cols).length
    return {
      colWidths: colList.map((col) => c.size(col)),
      rowHeights: rowList.map((row) => r.size(row)),
      colNames: options.headers ? colList.map(columnName) : undefined,
      rowNames: options.headers ? rowList.map((row) => String(row + 1)) : undefined,
      headerWidth: options.headers ? exportHeaderWidth(rowList) : 0,
      headerHeight: options.headers ? src.rowHeight() : 0,
      // a firmer line only between the frozen lines and the rest drawn
      frozenRows: frozenRows < rowList.length ? frozenRows : 0,
      frozenCols: frozenCols < colList.length ? frozenCols : 0,
      cells,
      gridlines: options.gridlines,
      background: options.background,
      theme: reader.theme,
    }
  }

  /** The cells of a sheet laid out as the grid draws them, in plain colors. */
  function drawingOf(options: SheetExportOptions = {}) {
    const t = src.target(options.sheet)
    const b = exportBounds(options.range, t)
    const gridlines = options.gridlines ?? src.gridlines()
    const reader = exportReader(src.root() ?? document.body, false, gridlines)
    try {
      return exportDrawing(
        shownLines(t.rows, b.top, b.bottom),
        shownLines(t.cols, b.left, b.right),
        { headers: options.headers ?? false, gridlines, background: options.background ?? true },
        reader,
        t,
      )
    } finally {
      reader.done()
    }
  }

  /** The sheet as an SVG document, and its size. */
  function exportImage(options: SheetExportOptions) {
    const laid = drawingOf(options)
    return { svg: drawSheet(laid, measureText), ...drawingSize(laid) }
  }

  function exportSVG(options: SheetExportOptions = {}) {
    return exportImage(options).svg
  }

  async function exportPNG(options: SheetImageOptions = {}) {
    const { svg, width, height } = exportImage(options)
    return svgToPNG(svg, {
      width,
      height,
      pixelRatio: options.pixelRatio,
      scope: '@dou-ui/sheet',
      hint: 'export a smaller range a part at a time, or use exportSVG() / toCSV()',
    })
  }

  function print(options: SheetPrintOptions = {}) {
    const t = src.target(options.sheet)
    const b = exportBounds(options.range, t)
    const gridlines = options.gridlines ?? src.gridlines()
    const headers = options.headers ?? false
    const { rows: r, cols: c, frozen: f } = t
    const rowList = shownLines(r, b.top, b.bottom)
    const colList = shownLines(c, b.left, b.right)
    // the frozen rows and columns are printed on every page
    const repeatRows = rowList.filter((row) => row < f.rows)
    const repeatCols = colList.filter((col) => col < f.cols)
    const bodyRows = rowList.filter((row) => row >= f.rows)
    const bodyCols = colList.filter((col) => col >= f.cols)
    const head = headers ? exportHeaderWidth(rowList) : 0
    const orientation =
      options.orientation ?? (head + sum(colList, c) > PAGE.portrait[0] ? 'landscape' : 'portrait')
    const [pageWidth, pageHeight] = PAGE[orientation]
    const title = options.title ?? ''
    const titleHeight = title ? 28 : 0
    const across = pagesOf(bodyCols, (i) => c.size(i), pageWidth - head - sum(repeatCols, c))
    const down = pagesOf(
      bodyRows,
      (i) => r.size(i),
      pageHeight - titleHeight - (headers ? src.rowHeight() : 0) - sum(repeatRows, r),
    )
    const reader = exportReader(src.root() ?? document.body, true, gridlines)
    const pages: string[] = []
    try {
      // down first, then across, as spreadsheets print
      for (const cols of across)
        for (const rows of down) {
          const drawing = exportDrawing(
            [...repeatRows, ...rows],
            [...repeatCols, ...cols],
            { headers, gridlines, background: true },
            reader,
            t,
          )
          pages.push(
            `<div class="page">${title ? `<h1>${escapeXML(title)}</h1>` : ''}${drawSheet(drawing, measureText)}</div>`,
          )
        }
    } finally {
      reader.done()
    }
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
    document.body.append(iframe)
    const doc = iframe.contentDocument!
    doc.open()
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXML(title || document.title)}</title><style>` +
        `@page{size:A4 ${orientation};margin:10mm;@bottom-center{content:counter(page) " / " counter(pages);font:9px ${reader.theme.fontFamily};color:#8a8a8a}}` +
        `html,body{margin:0}h1{margin:0 0 10px;font:600 14px/18px ${reader.theme.fontFamily};color:#1f1f1f}` +
        `.page{break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}` +
        `.page:last-child{break-after:auto}svg{display:block;max-width:100%;height:auto}` +
        `</style></head><body>${pages.join('')}</body></html>`,
    )
    doc.close()
    const win = iframe.contentWindow!
    const done = () => iframe.remove()
    win.addEventListener('afterprint', done)
    // browsers that print without a dialog, or never send afterprint
    setTimeout(done, 60_000)
    win.focus()
    win.print()
  }

  return { exportSVG, exportPNG, print, drawing: drawingOf }
}
