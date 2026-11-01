import { FileTextIcon } from '@dou-ui/icons'
import type { Component } from 'vue'
import { SheetFormulaEngine } from '../formula/engine'
import type { SheetFunction } from '../formula/functions'
import { shownValue, type SheetResult } from '../formula/values'
import { sheetMessagesFor, type SheetMessages } from '../locale'
import { boundsOf, parseRange, type SheetBounds } from './address'
import { resolveCellType, type SheetCellType, type SheetResolvedType } from './cell-type'
import { builtinCellTypes } from '../cell-types'
import { dataBounds, readCSV, sheetToCSV } from './csv'
import type { SheetExtension } from './extension'
import { resolveSheetExtensions } from './extension'
import { formatValue } from './format'
import {
  cellOf,
  valueOf,
  type SheetCellInput,
  type SheetData,
  type SheetStyle,
  type SheetValue,
  type SheetWorkbook,
} from './model'
import { sheetKey, type SheetRef } from './transaction'
import { labelOf, type SheetLabel } from './commands'
import { layStyle, SheetLooks } from './conditional'
import { plainStyle } from './paint'
import { colCountOf, rowCountOf } from './model'
import type { SheetDrawing } from '../export/draw'

/*
 * Files in and out. An exporter turns the workbook (or a sheet, or the
 * selection) into a file; an importer reads a file into a workbook. Both
 * only see data, so they also run outside the grid, e.g. on a server.
 */

/** What is exported: every sheet, the sheet shown, or the selected cells. */
export type SheetExportScope = 'workbook' | 'sheet' | 'selection'

/** A sheet to export, with the cells to write. */
export interface SheetFileSheet {
  /** Its place in the workbook. */
  index: number
  data: SheetData
  /** The cells to write: the selection, or from `A1` to the last cell with data; `null` when it is empty. */
  bounds: SheetBounds | null
}

/** What an exporter reads: the workbook and how its cells show, without the grid. */
export interface SheetFileSource {
  /** The workbook as it is stored. */
  book: SheetWorkbook
  /** What is being exported. */
  scope: SheetExportScope
  /** The sheets to write, in order: one, unless `scope` is `'workbook'`. */
  sheets: SheetFileSheet[]
  /** The language dates and numbers are written in. */
  locale?: string
  messages: SheetMessages
  /** A cell's value as stored: for a formula, the formula. */
  value: (sheet: number, row: number, col: number) => SheetValue
  /** What a cell comes to: its formula's result (an error as a `SheetError`), or its value. */
  result: (sheet: number, row: number, col: number) => SheetResult
  /** The text a cell shows, with its format and cell type, as the grid draws it. */
  text: (sheet: number, row: number, col: number) => string
  /**
   * The value to write into another spreadsheet program: the cell type's
   * `plain`, or what the cell comes to (an error as its code, such as `#DIV/0!`).
   */
  plain: (sheet: number, row: number, col: number) => SheetValue
  /**
   * How the cell looks: its named style with what its conditional formats
   * give it over it, `tone` and `fill` as the colors they are in the light
   * theme (in `color` and `background`). `{}` for a plain cell.
   */
  style: (sheet: number, row: number, col: number) => SheetStyle
  /** The cell's number or date format. */
  format: (sheet: number, row: number, col: number) => string | undefined
  /** The cell's type and its settings, or `undefined` for a plain cell. */
  cellType: (sheet: number, row: number, col: number) => SheetResolvedType | undefined
  /** Aborted when the export is called off. */
  signal?: AbortSignal
  /** Only for exporters with `needs: 'view'`, in the grid: the cells as the grid draws them. */
  view?: SheetFileView
}

/** What an exporter with `needs: 'view'` gets of the grid. */
export interface SheetFileView {
  /**
   * The cells exported laid out as the grid draws them: column widths, row
   * heights, text and looks in plain colors of the page's theme.
   */
  drawing: (options?: {
    headers?: boolean
    gridlines?: boolean
    background?: boolean
  }) => SheetDrawing
}

/** A way to write the workbook as a file, such as CSV; see `defineSheetExporter`. */
export interface SheetExporter<Options = any> {
  /** Unique among the exporters; `exportFile` takes it. */
  name: string
  /** Its name in the toolbar's export menu. */
  label: SheetLabel
  icon?: Component
  /** The file name's extension, without the dot, e.g. `xlsx`. */
  extension: string
  /** The file's media type. */
  mime: string
  /** What it can export, the first being what the toolbar exports. Defaults to every scope. */
  scopes?: SheetExportScope[]
  /**
   * `'view'` for an exporter that draws the cells as the grid shows them
   * (sizes, the page's colors), which gets `source.view` and only works in
   * the grid; `exportWorkbook` refuses it. Defaults to `'data'`.
   */
  needs?: 'data' | 'view'
  /** Writes the file. A string is wrapped in a `Blob` of `mime`. */
  export: (source: SheetFileSource, options?: Options) => Blob | string | Promise<Blob | string>
}

/** Declares an exporter; only gives it a type. */
export function defineSheetExporter<Options = any>(
  exporter: SheetExporter<Options>,
): SheetExporter<Options> {
  return exporter
}

/** An exporter as menus show it, its label in the sheet's language. */
export interface SheetExporterInfo {
  name: string
  label: string
  icon?: Component
  extension: string
  mime: string
  /** What it can export, the first being what it exports by default. */
  scopes: SheetExportScope[]
}

/** An importer as menus show it, its label in the sheet's language. */
export interface SheetImporterInfo {
  name: string
  label: string
  accept: string[]
}

export const exporterInfo = (
  exporter: SheetExporter,
  messages: SheetMessages,
): SheetExporterInfo => ({
  name: exporter.name,
  label: labelOf(exporter.label, messages),
  icon: exporter.icon,
  extension: exporter.extension,
  mime: exporter.mime,
  scopes: [...(exporter.scopes ?? ['workbook', 'sheet', 'selection'])],
})

export const importerInfo = (
  importer: SheetImporter,
  messages: SheetMessages,
): SheetImporterInfo => ({
  name: importer.name,
  label: labelOf(importer.label, messages),
  accept: [...importer.accept],
})

/** Something an importer couldn't bring over, such as images or borders. */
export interface SheetImportWarning {
  /** A short name for what was lost, e.g. `'border'`. */
  code: string
  /** It in words, for people. */
  message: string
  /** How many times it came up. */
  count?: number
  /** The sheet it was on. */
  sheet?: string
}

/** What an importer read. */
export interface SheetImportResult {
  book: SheetWorkbook
  warnings?: SheetImportWarning[]
}

/** What an importer gets besides the file. */
export interface SheetImportContext {
  messages: SheetMessages
  locale?: string
  signal?: AbortSignal
}

/** A way to read a file into a workbook, such as CSV; see `defineSheetImporter`. */
export interface SheetImporter<Options = any> {
  /** Unique among the importers; `importFile`'s `importer` takes it. */
  name: string
  /**
   * What the files it reads are called, such as “CSV 文件”: in the hints the
   * grid shows about a file without a name, and in `useSheet().importers`
   * for a menu of your own.
   */
  label: SheetLabel
  /**
   * The files it reads, as the file picker's `accept` takes them: extensions
   * such as `.csv` and media types such as `text/csv`.
   */
  accept: string[]
  /** Tells from the file's first bytes whether it reads it, for files whose name says nothing. */
  sniff?: (head: Uint8Array) => boolean
  import: (
    file: Blob,
    context: SheetImportContext,
    options?: Options,
  ) => SheetImportResult | Promise<SheetImportResult>
}

/** Declares an importer; only gives it a type. */
export function defineSheetImporter<Options = any>(
  importer: SheetImporter<Options>,
): SheetImporter<Options> {
  return importer
}

/** Whether an importer takes a file, by its name, type or first bytes. */
export async function importerTakes(importer: SheetImporter, file: Blob) {
  const name = 'name' in file ? String((file as File).name).toLowerCase() : ''
  for (const accept of importer.accept) {
    const want = accept.toLowerCase()
    if (want.startsWith('.') ? name.endsWith(want) : matchType(file.type, want)) return true
  }
  if (!importer.sniff) return false
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer())
  return importer.sniff(head)
}

const matchType = (type: string, want: string) =>
  !!type && (want.endsWith('/*') ? type.startsWith(want.slice(0, -1)) : type === want)

/** The first importer that takes a file, or `undefined`. */
export async function findImporter(importers: readonly SheetImporter[], file: Blob) {
  for (const importer of importers) if (await importerTakes(importer, file)) return importer
  return undefined
}

/** How a source reads a workbook. */
export interface SheetFileSourceOptions {
  scope?: SheetExportScope
  /** The sheet for `'sheet'` and `'selection'`; the first by default. */
  sheet?: number
  /** For `'selection'` (or to write part of a sheet): the cells. */
  bounds?: SheetBounds
  /** What formulas come to, by sheet key; a new engine works them out by default. */
  result?: (key: string, row: number, col: number) => SheetResult
  cellTypes?: ReadonlyMap<string, SheetCellType>
  functions?: readonly SheetFunction[]
  locale?: string
  messages?: SheetMessages
  /** Works out a formula as if it were in a cell of a sheet, by key, for conditional formats; with `result`. */
  evaluate?: (formula: string, key: string) => unknown
  signal?: AbortSignal
  view?: SheetFileView
}

/** The cell types by name: the built-in ones, then these, the first named winning. */
export function cellTypeMap(added: readonly SheetCellType[] = []) {
  const map = new Map<string, SheetCellType>()
  for (const type of builtinCellTypes) map.set(type.name, type)
  const seen = new Set<string>()
  for (const type of added) {
    if (seen.has(type.name)) continue
    seen.add(type.name)
    map.set(type.name, type)
  }
  return map
}

/** What exporters read: a workbook and how its cells show. */
export function createFileSource(
  book: SheetWorkbook,
  options: SheetFileSourceOptions = {},
): SheetFileSource {
  const scope = options.scope ?? 'workbook'
  const types = options.cellTypes ?? cellTypeMap()
  const locale = options.locale
  let result = options.result
  let evaluate = options.evaluate
  if (!result || !evaluate) {
    const engine = new SheetFormulaEngine(book, {
      functions: options.functions,
      locale,
    })
    result ??= (key, row, col) => engine.result(key, row, col)
    evaluate ??= (formula, key) => engine.evaluate(formula, key)
  }
  const read = result
  const work = evaluate
  const at = (sheet: number, row: number) => book.sheets[sheet]?.cells[row]
  const input = (sheet: number, row: number, col: number): SheetCellInput => at(sheet, row)?.[col]
  const resultOf = (sheet: number, row: number, col: number): SheetResult => {
    const data = book.sheets[sheet]
    if (!data) return null
    const value = valueOf(input(sheet, row, col))
    if (typeof value !== 'string' || !value.startsWith('=')) return value
    return read(sheetKey(data), row, col)
  }
  const shown = (sheet: number, row: number, col: number): SheetValue => {
    const data = book.sheets[sheet]
    if (!data) return null
    const key = sheetKey(data)
    const value = valueOf(input(sheet, row, col))
    if (typeof value !== 'string' || !value.startsWith('=')) return value
    // errors as their code, as the grid shows them
    return shownValue(value, (r, c) => read(key, r, c), row, col) as SheetValue
  }
  const typeOf = (sheet: number, row: number, col: number) =>
    resolveCellType(cellOf(input(sheet, row, col)), book, types)
  const textOf = (sheet: number, row: number, col: number) => {
    const value = shown(sheet, row, col)
    const typed = typeOf(sheet, row, col)
    const own = typed?.definition.format?.(value, typed.setup)
    if (own !== undefined) return own
    return formatValue(value, cellOf(input(sheet, row, col))?.format, locale)
  }
  // conditional formats, worked out for a sheet the first time one of its cells is asked about
  const looks = new Map<number, SheetLooks>()
  const looksOf = (sheet: number) => {
    let found = looks.get(sheet)
    if (!found) {
      const data = book.sheets[sheet]!
      const key = sheetKey(data)
      found = new SheetLooks(data.conditionalFormats, {
        valueAt: (row, col) => resultOf(sheet, row, col),
        textAt: (row, col) => textOf(sheet, row, col),
        evaluate: (formula) => work(formula, key),
        styles: book.styles,
        size: { rows: rowCountOf(data), cols: colCountOf(data) },
        lang: locale,
      })
      looks.set(sheet, found)
    }
    return found
  }
  const styleOf = (sheet: number, row: number, col: number) => {
    if (!book.sheets[sheet]) return {}
    const name = cellOf(input(sheet, row, col))?.style
    const own = name ? book.styles?.[name] : undefined
    const look = book.sheets[sheet]!.conditionalFormats?.length
      ? looksOf(sheet).lookAt(row, col)?.style
      : undefined
    const style = look ? layStyle(own, look) : own
    return style ? plainStyle(style) : {}
  }

  const index = options.sheet ?? 0
  const pick = (i: number): SheetFileSheet => {
    const data = book.sheets[i]!
    return { index: i, data, bounds: dataBounds(data) }
  }
  let sheets: SheetFileSheet[]
  if (scope === 'workbook') sheets = book.sheets.map((_, i) => pick(i))
  else {
    if (!book.sheets[index]) throw new RangeError(`[@dou-ui/sheet] there is no sheet ${index}`)
    const sheet = pick(index)
    if (options.bounds) sheet.bounds = options.bounds
    sheets = [sheet]
  }

  return {
    book,
    scope,
    sheets,
    locale,
    messages: options.messages ?? sheetMessagesFor(locale),
    value: (sheet, row, col) => valueOf(input(sheet, row, col)),
    result: resultOf,
    text: textOf,
    plain(sheet, row, col) {
      const value = shown(sheet, row, col)
      const typed = typeOf(sheet, row, col)
      return typed?.definition.plain ? typed.definition.plain(value, typed.setup) : value
    },
    style: styleOf,
    format: (sheet, row, col) => cellOf(input(sheet, row, col))?.format,
    cellType: typeOf,
    signal: options.signal,
    view: options.view,
  }
}

/** Options of `exportWorkbook`. */
export interface SheetExportWorkbookOptions<Options = any> {
  /** The extensions whose cell types and functions the workbook uses. */
  extensions?: (SheetExtension | SheetExtension[])[]
  /** `'workbook'` by default, or the exporter's first scope when it can't. */
  scope?: SheetExportScope
  /** The sheet, by index, `id` or name, for `'sheet'` and `'selection'`; the first by default. */
  sheet?: SheetRef
  /** The cells, such as `'A1:D20'`, for `'selection'`. */
  range?: string
  locale?: string
  messages?: SheetMessages
  signal?: AbortSignal
  /** Passed on to the exporter. */
  options?: Options
}

/** The scope an exporter writes: the one asked for when it can, otherwise its first. */
export function scopeFor(exporter: SheetExporter, asked?: SheetExportScope) {
  const scopes = exporter.scopes ?? ['workbook', 'sheet', 'selection']
  if (asked && !scopes.includes(asked))
    throw new RangeError(
      `[@dou-ui/sheet] the exporter "${exporter.name}" can't export a ${asked}; it exports ${scopes.join(', ')}`,
    )
  return asked ?? scopes[0]!
}

/** An exporter's output as a `Blob`. */
export const toBlob = (out: Blob | string, mime: string) =>
  typeof out === 'string' ? new Blob([out], { type: mime }) : out

/**
 * Writes a workbook with an exporter, without a grid: in a script, a
 * worker or on a server. Formulas are worked out on the way.
 */
export async function exportWorkbook<Options>(
  book: SheetWorkbook,
  exporter: SheetExporter<Options>,
  options: SheetExportWorkbookOptions<Options> = {},
): Promise<Blob> {
  if (exporter.needs === 'view')
    throw new Error(
      `[@dou-ui/sheet] the exporter "${exporter.name}" draws the grid, so it only works in DouSheet`,
    )
  const resolved = resolveSheetExtensions(options.extensions)
  const scope = scopeFor(exporter, options.scope)
  let bounds: SheetBounds | undefined
  if (options.range != null) {
    const range = parseRange(options.range)
    if (!range) throw new RangeError(`[@dou-ui/sheet] "${options.range}" isn't a range`)
    bounds = boundsOf(range)
  }
  let sheet: number | undefined
  if (options.sheet != null) {
    const ref = options.sheet
    sheet =
      typeof ref === 'number'
        ? ref
        : book.sheets.findIndex((s) => s.id === ref || (s.id == null && s.name === ref))
    if (!book.sheets[sheet]) throw new RangeError(`[@dou-ui/sheet] there is no sheet "${ref}"`)
  }
  const source = createFileSource(book, {
    scope,
    sheet,
    bounds,
    cellTypes: cellTypeMap(resolved.cellTypes),
    functions: resolved.functions,
    locale: options.locale,
    messages: options.messages,
    signal: options.signal,
  })
  return toBlob(await exporter.export(source, options.options), exporter.mime)
}

/** Options of `readWorkbook`. */
export interface SheetReadWorkbookOptions<Options = any> {
  locale?: string
  messages?: SheetMessages
  signal?: AbortSignal
  /** Passed on to the importer. */
  options?: Options
}

/** Reads a file with an importer, without a grid. */
export async function readWorkbook<Options>(
  file: Blob,
  importer: SheetImporter<Options>,
  options: SheetReadWorkbookOptions<Options> = {},
): Promise<SheetImportResult> {
  const messages = options.messages ?? sheetMessagesFor(options.locale)
  return importer.import(
    file,
    { messages, locale: options.locale, signal: options.signal },
    options.options,
  )
}

/** The name of a file without its extension, for a sheet's name. */
export const baseName = (file: Blob) => {
  const name = 'name' in file ? String((file as File).name) : ''
  return name.replace(/\.[^.]*$/, '')
}

/** Options of the CSV exporter. */
export interface SheetCSVExportOptions {
  /** `,` by default. */
  delimiter?: string
  /** Starts with a byte order mark, so programs that guess the encoding read it as UTF-8. On by default. */
  bom?: boolean
  /** Writes the values as stored (formulas as written) instead of what the cells show. */
  formatted?: boolean
}

/** CSV: one sheet (or the selected cells), with what the cells show. */
export const csvExporter = defineSheetExporter<SheetCSVExportOptions>({
  name: 'csv',
  label: (m) => m.file.csv,
  icon: FileTextIcon,
  extension: 'csv',
  mime: 'text/csv',
  scopes: ['sheet', 'selection'],
  export(source, options = {}) {
    const { index, data, bounds } = source.sheets[0]!
    if (!bounds) return options.bom === false ? '' : '﻿'
    return sheetToCSV(data, {
      range: {
        start: { row: bounds.top, col: bounds.left },
        end: { row: bounds.bottom, col: bounds.right },
      },
      locale: source.locale,
      result: (row, col) => source.result(index, row, col),
      text: (_input, _value, row, col) => source.text(index, row, col),
      delimiter: options.delimiter,
      formatted: options.formatted,
      bom: options.bom ?? true,
    })
  },
})

/** CSV and tab-separated text: a new sheet named after the file. */
export const csvImporter = defineSheetImporter({
  name: 'csv',
  label: (m) => m.file.csv,
  accept: ['.csv', '.tsv', '.txt', 'text/csv', 'text/tab-separated-values', 'text/plain'],
  async import(file) {
    const text = await file.text()
    const name = baseName(file) || 'Sheet1'
    return { book: { sheets: [{ name, cells: readCSV(text) }] } }
  },
})

/** A label as text. */
export const fileLabel = (label: SheetLabel, messages: SheetMessages) => labelOf(label, messages)

/**
 * Puts the built-in exporters (or importers) and the extensions' together,
 * by name: an extension's replaces a built-in one of the same name; two
 * extensions with the same name are an error.
 */
export function mergeFileHandlers<T extends { name: string }>(
  builtin: readonly T[],
  added: readonly { extension: string; handler: T }[],
  kind: 'exporter' | 'importer',
) {
  const owner = new Map<string, string>()
  const own: T[] = []
  for (const { extension, handler } of added) {
    const taken = owner.get(handler.name)
    if (taken)
      throw new Error(
        `[@dou-ui/sheet] the ${kind} "${handler.name}" is added by both "${taken}" and "${extension}"`,
      )
    owner.set(handler.name, extension)
    own.push(handler)
  }
  const rest = builtin.filter((handler) => !owner.has(handler.name))
  // exporters keep the built-in ones first, as the menu shows them; importers ask the added ones first
  return kind === 'exporter' ? [...rest, ...own] : [...own, ...rest]
}
