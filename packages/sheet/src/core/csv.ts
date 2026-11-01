import { boundsOf, parseRange, type SheetBounds, type SheetRange } from './address'
import { formatValue, inputText, parseInput } from './format'
import {
  cellOf,
  valueOf,
  type SheetCellInput,
  type SheetData,
  type SheetRow,
  type SheetValue,
} from './model'
import { shownValue, type SheetResult } from '../formula/values'

/*
 * CSV and other delimited text: reading it into a sheet and writing a
 * sheet out, the way spreadsheet programs exchange plain tables
 * (RFC 4180: fields with the delimiter, a quote or a line break are quoted,
 * quotes inside doubled).
 */

const DELIMITERS = [',', ';', '\t', '|'] as const

/**
 * The delimiter a text most likely uses: of `,`, `;`, tab and `|`, the one
 * found most often outside quotes in its first lines, and the same number
 * of times on each. A comma when none is found.
 */
export function detectDelimiter(text: string) {
  const counts = new Map<string, number[]>(DELIMITERS.map((d) => [d, [0]]))
  let quoted = false
  let lines = 0
  for (let i = 0; i < text.length && lines < 10; i++) {
    const char = text[i]!
    if (char === '"') quoted = !quoted
    else if (quoted) continue
    else if (char === '\n') {
      lines++
      for (const line of counts.values()) line.push(0)
    } else {
      const line = counts.get(char)
      if (line) line[line.length - 1]!++
    }
  }
  let best: string = ','
  let score = 0
  for (const [delimiter, perLine] of counts) {
    // a last line cut short or left empty doesn't count
    const full =
      perLine.length > 1 && perLine[perLine.length - 1] === 0 ? perLine.slice(0, -1) : perLine
    const first = full[0] ?? 0
    if (!first) continue
    const steady = full.every((n) => n === first)
    const value = first * (steady ? 2 : 1)
    if (value > score) {
      score = value
      best = delimiter
    }
  }
  return best
}

/**
 * Splits delimited text into rows of fields, reading quoted fields; a
 * byte order mark at the start is dropped. `delimiter` defaults to the one
 * `detectDelimiter` finds.
 */
export function parseCSV(text: string, delimiter = detectDelimiter(text)): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  // whether the field so far came from quotes: `""` is an empty field, not a missing one
  let wasQuoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"' && field === '') {
      quoted = true
      wasQuoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
      wasQuoted = false
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      wasQuoted = false
    } else field += char
  }
  if (field !== '' || wasQuoted || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** A field that reads as a number but is a code: leading zeros, or more digits than a number keeps. */
const CODE = /^(?:[-+]?0\d+|[-+]?\d{16,})$/

export interface SheetCSVReadOptions {
  /** `,`, `;`, a tab…; found from the text when left out. */
  delimiter?: string
  /**
   * Reads numbers, dates, times, percentages and `TRUE` / `FALSE` as such,
   * the way typing them does; `false` keeps every field as text. Fields
   * that look like codes, `007` or a long card number, stay text either way.
   */
  typed?: boolean
  /**
   * The decimal mark of numbers: `,` reads `1,5` as 1.5 and `1.280,5` as
   * 1280.5. Defaults to `,` when fields are split by `;`, as files written
   * with a decimal comma are, otherwise `.`.
   */
  decimal?: '.' | ','
  /** Reads fields starting with `=` as formulas; by default they are text. */
  formulas?: boolean
}

/** A number written with a decimal comma: `1,5`, `-1.280,5`, `12,5%`. */
const COMMA_NUMBER = /^([-+]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(%?)$/

/** The cells of a CSV, row by row, ready for a sheet's `cells` or `tr.setCells`. */
export function readCSV(text: string, options: SheetCSVReadOptions = {}): SheetRow[] {
  const { typed = true, formulas = false } = options
  const delimiter = options.delimiter ?? detectDelimiter(text)
  const comma = (options.decimal ?? (delimiter === ';' ? ',' : '.')) === ','
  return parseCSV(text, delimiter).map((fields) =>
    fields.map((field): SheetCellInput => {
      if (field === '') return undefined
      if (field.startsWith('=') && field.length > 1) return formulas && typed ? field : `'${field}`
      if (!typed || CODE.test(field.trim()) || field.startsWith("'")) return field
      let input = field
      if (comma) {
        const number = COMMA_NUMBER.exec(field.trim())
        if (number) {
          const [, sign, whole, fraction, percent] = number
          input = `${sign}${whole!.replaceAll('.', '')}${fraction ? `.${fraction}` : ''}${percent}`
        }
      }
      const { value, format } = parseInput(input)
      if (value == null) return undefined
      return format ? { value, format } : value
    }),
  )
}

export interface SheetCSVWriteOptions {
  /** `,` by default. */
  delimiter?: string
  /** Only these cells, such as `'A1:D20'`; by default up to the last row and column with data. */
  range?: string | SheetRange
  /**
   * Writes what each cell shows, with its format (`¥1,280.00`,
   * `2026年3月5日`); `false` writes the values as stored (`1280`,
   * `2026-03-05`, formulas as written).
   */
  formatted?: boolean
  /** The language dates are shown in. */
  locale?: string
  /**
   * What a formula comes to, by its row and column in the sheet, e.g. from
   * `SheetFormulaEngine.result`; with `formatted`, the formula itself by default.
   */
  result?: (row: number, col: number) => SheetResult
  /**
   * A cell's text, e.g. as its cell type shows it; `undefined` uses its
   * format. `value` is its value, or its formula's result; `row` and `col`
   * are where it is in the sheet.
   */
  text?: (input: SheetCellInput, value: SheetValue, row: number, col: number) => string | undefined
  /** Line breaks between rows; `\r\n` by default, as the format asks. */
  newline?: string
  /** Starts with a byte order mark, so programs that guess the encoding read it as UTF-8. */
  bom?: boolean
  /**
   * Puts a `'` before text starting with `=`, `+`, `-`, `@`, a tab or a
   * line break, so a spreadsheet program opening the file doesn't run it as
   * a formula. Numbers are written as they are, and so are this grid's
   * formulas with `formatted: false`. On by default; `false` writes such
   * text as it is.
   */
  escapeFormulas?: boolean
}

/** What a spreadsheet program would start a formula with. */
const FORMULA_START = /^[=+\-@\t\r]/

/** Where a sheet has data: up to its last row and column with something in them. */
export function dataBounds(sheet: SheetData): SheetBounds | null {
  let bottom = -1
  let right = -1
  sheet.cells.forEach((line, row) => {
    if (!line) return
    for (let col = line.length - 1; col >= 0; col--)
      if (valueOf(line[col]) != null && valueOf(line[col]) !== '') {
        bottom = row
        right = Math.max(right, col)
        break
      }
  })
  return bottom === -1 ? null : { top: 0, left: 0, bottom, right }
}

/** A sheet, or part of it, as CSV. */
export function sheetToCSV(sheet: SheetData, options: SheetCSVWriteOptions = {}) {
  const {
    delimiter = ',',
    formatted = true,
    locale,
    text,
    result,
    newline = '\r\n',
    bom,
    escapeFormulas = true,
  } = options
  const range = typeof options.range === 'string' ? parseRange(options.range) : options.range
  if (options.range != null && !range) throw new RangeError(`"${options.range}" isn't a range`)
  const data = dataBounds(sheet)
  const b = range ? boundsOf(range) : data
  if (!b || !data) return bom ? '\ufeff' : ''
  const quote = new RegExp(`["\\r\\n${delimiter.replace(/[\\\]^-]/g, '\\$&')}]`)
  const field = (value: string) => (quote.test(value) ? `"${value.replaceAll('"', '""')}"` : value)
  const lines: string[] = []
  // empty rows and columns past the data are left out, also of whole columns or rows
  const bottom = Math.min(b.bottom, data.bottom)
  const right = Math.min(b.right, data.right)
  for (let row = b.top; row <= bottom; row++) {
    const line = sheet.cells[row]
    const fields: string[] = []
    for (let col = b.left; col <= right; col++) {
      const input = line?.[col]
      const stored = valueOf(input)
      const value = formatted ? shownValue(stored, result, row, col) : stored
      const shown = formatted
        ? (text?.(input, value, row, col) ?? formatValue(value, cellOf(input)?.format, locale))
        : rawText(value)
      // written as stored, this grid's formulas stay formulas, to be read back with `formulas`
      const formula = !formatted && typeof value === 'string' && value.startsWith('=')
      const unsafe =
        escapeFormulas && !formula && typeof value === 'string' && FORMULA_START.test(shown)
      fields.push(field(unsafe ? `'${shown}` : shown))
    }
    lines.push(fields.join(delimiter))
  }
  return (bom ? '\ufeff' : '') + lines.join(newline)
}

/** A value as stored, as text: numbers in full, `TRUE` / `FALSE`, text and formulas as they are. */
function rawText(value: ReturnType<typeof valueOf>) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return inputText(value)
}
