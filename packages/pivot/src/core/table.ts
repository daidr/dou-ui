import type { PivotSheetCell } from '../types'

/*
 * The table as plain cells, for copying, CSV, a sheet and printing. Each
 * row field has a column of its own, whatever the layout on screen; the
 * column headers keep their groups as spans.
 */

/** A cell of the table as it is copied or exported. */
export interface PivotGridCell {
  /** What the cell shows. */
  text: string
  /** `head`: a column header or the corner; `label`: a row's group; `value`: a number. */
  kind: 'head' | 'label' | 'value'
  /** For `value`: the number as shown (a share, when the value has `show`); `NaN` when empty. */
  value?: number
  /** For `value`: the value's place in `config.values`. */
  valueIndex?: number
  /** A subtotal or a total: a line, a column or both. */
  total?: boolean
  /** A header over several columns or rows; the cells it covers are `null`. */
  colSpan?: number
  rowSpan?: number
}

/** The table, or part of it, row by row. */
export interface PivotGrid {
  cells: (PivotGridCell | null)[][]
  /** How many rows at the top are column headers, and how many columns at the left are row headers. */
  headRows: number
  headCols: number
  /** Each value's number format for a sheet (`#,##0.00`, `0.0%`), by its place in `config.values`. */
  formats: (string | undefined)[]
  /** The width of each column on screen, in px. */
  widths: number[]
}

/** A number without the float noise of adding up (`1592.0200000000002` is `1592.02`). */
export const tidyNumber = (n: number) => (Number.isFinite(n) ? Number(n.toPrecision(15)) : n)

/** What a spreadsheet program would start a formula with. */
const FORMULA_START = /^[=+\-@\t\r]/

/** A cell's text in CSV or tab-separated text, with a number as its value or its text. */
function plainText(cell: PivotGridCell | null, text: boolean) {
  if (!cell) return ''
  if (cell.kind === 'value') {
    const v = cell.value!
    return text ? cell.text : v === v ? String(tidyNumber(v)) : ''
  }
  return cell.text
}

export interface PivotCSVOptions {
  /**
   * Write the numbers as the table shows them (`¥1,280.00`, `21.3%`)
   * instead of values a spreadsheet can add up (`1280`, `0.213`).
   * Defaults to `false`.
   */
  text?: boolean
  /** Start with a byte order mark, so spreadsheets read the file as UTF-8. Defaults to `true`. */
  bom?: boolean
  /**
   * Put a `'` before labels a spreadsheet program would run as a formula
   * (starting with `=`, `+`, `-`, `@`, a tab or a carriage return). Defaults to
   * `true`; `false` writes them as they are.
   */
  escapeFormulas?: boolean
}

/** The grid as CSV. Labels that a spreadsheet would read as a formula get a `'` in front. */
export function gridToCSV(grid: PivotGrid, options: PivotCSVOptions = {}) {
  const escape = options.escapeFormulas !== false
  const field = (cell: PivotGridCell | null) => {
    let s = plainText(cell, !!options.text)
    if (escape && cell && cell.kind !== 'value' && FORMULA_START.test(s)) s = `'${s}`
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  const lines = grid.cells.map((row) => row.map(field).join(','))
  return (options.bom === false ? '' : '﻿') + lines.join('\r\n')
}

/** The grid as tab-separated text, with the numbers as they show, for the clipboard. */
function tsvField(cell: PivotGridCell | null) {
  const s = cell?.text ?? ''
  return /[\t\n\r"]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function gridToTSV(grid: PivotGrid) {
  return grid.cells.map((row) => row.map(tsvField).join('\t')).join('\n')
}

const escapeHTML = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** The styles the sheet cells refer to. */
export const SHEET_STYLES = {
  'pivot-head': { bold: true },
  'pivot-total': { bold: true },
}

/**
 * A format whose decimals are optional (`#,##0.##`), for a number that
 * needs none of them: without them, as Excel would show `226,895.` for
 * `226895`.
 */
function fitFormat(format: string, value: number) {
  const optional = /\.(0*)#+/
  const match = optional.exec(format)
  if (!match) return format
  // a percentage shows the value a hundred times over
  const shown = format.includes('%') ? value * 100 : value
  const scaled = shown * 10 ** match[1]!.length
  if (Math.abs(scaled - Math.round(scaled)) > 1e-9) return format
  return format.replace(/\.(0*)#+/g, (_, zeros: string) => (zeros ? `.${zeros}` : ''))
}

function sheetCell(cell: PivotGridCell | null, formats: PivotGrid['formats']): PivotSheetCell {
  if (!cell) return null
  if (cell.kind === 'value') {
    const v = tidyNumber(cell.value!)
    if (v !== v) return null
    const given = formats[cell.valueIndex!]
    const format = given && fitFormat(given, v)
    if (!format && !cell.total) return v
    return {
      value: v,
      ...(format ? { format } : {}),
      ...(cell.total ? { style: 'pivot-total' } : {}),
    }
  }
  if (cell.text === '') return null
  // text a sheet would read as a formula
  const text = cell.text.startsWith('=') ? `'${cell.text}` : cell.text
  const style = cell.kind === 'head' ? 'pivot-head' : cell.total ? 'pivot-total' : undefined
  return style ? { value: text, style } : text
}

/** The cells as `DouSheet` takes them, row by row. */
export function gridToSheetCells(grid: PivotGrid): PivotSheetCell[][] {
  return grid.cells.map((row) => row.map((cell) => sheetCell(cell, grid.formats)))
}

/** `A`, `B`, … `Z`, `AA`: a column's letters. */
function columnName(col: number) {
  let name = ''
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

/** The merged header cells, as ranges such as `'B1:D1'`. */
export function gridMerges(grid: PivotGrid): string[] {
  const out: string[] = []
  grid.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      const cols = cell?.colSpan ?? 1
      const rows = cell?.rowSpan ?? 1
      if (cols > 1 || rows > 1)
        out.push(`${columnName(c)}${r + 1}:${columnName(c + cols - 1)}${r + rows}`)
    }),
  )
  return out
}

/** The mark `DouSheet` puts on a table it copies, holding its cells. */
const SHEET_MARK = 'data-dou-sheet'

/**
 * The grid as an HTML table, for the clipboard and for printing: headers in
 * `<thead>` (repeated on each printed page), spans kept. With `sheet`, the
 * table also carries the cells for `DouSheet`, so pasting there keeps the
 * numbers and their formats.
 */
export function gridToHTML(grid: PivotGrid, { sheet = false }: { sheet?: boolean } = {}) {
  const row = (cells: (PivotGridCell | null)[], head: boolean) => {
    let out = ''
    cells.forEach((cell, c) => {
      if (!cell) return
      const tag = cell.kind === 'value' ? 'td' : 'th'
      const span =
        (cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '') +
        (cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '')
      const cls = [
        cell.kind === 'value' ? 'is-value' : cell.kind === 'label' ? 'is-label' : 'is-head',
        cell.total && 'is-total',
        !head && c === grid.headCols - 1 && 'is-edge',
        head && c >= grid.headCols && 'is-end',
      ]
        .filter(Boolean)
        .join(' ')
      const scope = tag === 'th' && !head ? ' scope="row"' : ''
      const align = cell.kind === 'value' ? ' style="text-align:right"' : ''
      out += `<${tag}${span}${scope} class="${cls}"${align}>${escapeHTML(cell.text)}</${tag}>`
    })
    return `<tr>${out}</tr>`
  }
  const head = grid.cells.slice(0, grid.headRows).map((r) => row(r, true))
  const body = grid.cells.slice(grid.headRows).map((r) => row(r, false))
  const mark = sheet
    ? ` ${SHEET_MARK}="${escapeHTML(JSON.stringify({ cells: gridToSheetCells(grid), styles: SHEET_STYLES }))}"`
    : ''
  return (
    `<table${mark} style="border-collapse:collapse">` +
    (head.length ? `<thead>${head.join('')}</thead>` : '') +
    `<tbody>${body.join('')}</tbody></table>`
  )
}

/** A sheet number format that writes numbers like these `Intl.NumberFormat` options. */
export function sheetFormat(options: Intl.NumberFormatOptions, locale: string): string | undefined {
  const style = options.style ?? 'decimal'
  if (style === 'unit') return undefined
  const currency = style === 'currency'
  const percent = style === 'percent'
  // like Intl: a maximum below the default minimum lowers the minimum
  const ownMax = options.maximumFractionDigits
  const min = options.minimumFractionDigits ?? Math.min(currency ? 2 : 0, ownMax ?? Infinity)
  const max = Math.max(min, ownMax ?? (currency ? 2 : percent ? 0 : 3))
  const grouping = options.useGrouping !== false && (options.useGrouping as unknown) !== 'false'
  let body = grouping ? '#,##0' : '0'
  if (max > 0) body += `.${'0'.repeat(min)}${'#'.repeat(max - min)}`
  if (percent) body += '%'
  if (currency) {
    let symbol = ''
    try {
      symbol =
        new Intl.NumberFormat(locale, options).formatToParts(1).find((p) => p.type === 'currency')
          ?.value ?? ''
    } catch {
      return undefined
    }
    body = `"${symbol.replaceAll('"', '')}"${body}`
  }
  // the sign shown on positive numbers too
  if (options.signDisplay === 'exceptZero' || options.signDisplay === 'always')
    return `+${body};-${body};${body}`
  return body
}
