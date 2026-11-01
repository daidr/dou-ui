import {
  boundsOf,
  columnName,
  isSheetError,
  lightThemeColor,
  meetsRule,
  parseRange,
  plainStyle,
  quoteSheet,
  renameReferencesAll,
  serialOf,
  textCollator,
  type SheetBounds,
  type SheetColor,
  type SheetCondition,
  type SheetConditionalFormat,
  type SheetConditionalStyle,
  type SheetData,
  type SheetFileSource,
  type SheetStyle,
  type SheetValidation,
  type SheetValue,
} from '@dou-ui/sheet'
import { argb, StyleSheet } from './styles'
import { attrs, esc, HEAD, NS, NS_PKG, NS_R } from './xml'
import { pause, SLICE, zip, type ZipEntry } from './zip'

/** Options of the .xlsx exporter. */
export interface SheetXlsxExportOptions {
  /**
   * Writes formulas, with what they came to so other programs show the
   * results until they work them out again; `false` writes only the
   * results, e.g. for formulas with functions only this grid has. `true`
   * by default; exporting the selection always writes the results.
   */
  formulas?: boolean
}

/** An error as the file can hold it: a formula that depends on itself as `#VALUE!`. */
const errorCode = (code: string) => esc(code === '#CYCLE!' ? '#VALUE!' : code)

const encoder = new TextEncoder()

/** The deepest outline level, `undefined` for none. */
function maxLevel(levels: Map<number, number>) {
  let max = 0
  for (const level of levels.values()) if (level > max) max = level
  return max || undefined
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/
const TIME = /^\d{2}:\d{2}(:\d{2})?$/

/** The number format of a date or time written as text, when the cell has none. */
function dateFormat(text: string) {
  if (DATE.test(text)) return 'yyyy-mm-dd'
  if (DATE_TIME.test(text)) return text.length > 16 ? 'yyyy-mm-dd hh:mm:ss' : 'yyyy-mm-dd hh:mm'
  if (TIME.test(text)) return text.length > 5 ? 'hh:mm:ss' : 'hh:mm'
  return undefined
}

/** Column widths: px to the characters the file counts in. */
const widthOf = (px: number) => Math.max(0, Math.round(((px - 5) / 7) * 100) / 100)
/** Row heights: px to points. */
const heightOf = (px: number) => Math.round(px * 0.75 * 100) / 100

const cellName = (row: number, col: number) => `${columnName(col)}${row + 1}`
const rangeText = (b: SheetBounds) =>
  b.top === b.bottom && b.left === b.right
    ? cellName(b.top, b.left)
    : `${cellName(b.top, b.left)}:${cellName(b.bottom, b.right)}`

const ILLEGAL = /[[\]:*?/\\]/g
/** Whether other programs take a sheet name as it is. */
const legalName = (name: string) =>
  name.length > 0 &&
  name.length <= 31 &&
  !/[[\]:*?/\\]/.test(name) &&
  !name.startsWith("'") &&
  !name.endsWith("'")

/**
 * Sheet names other programs take: at most 31 characters, none of
 * `[]:*?/\`, no `'` at either end, each different ignoring case. Names
 * that are fine stay as they are; the others are changed, with a number
 * after them when that makes them the same as another.
 */
function sheetNames(names: string[]) {
  const out: (string | undefined)[] = []
  const taken = new Set<string>()
  for (const [i, name] of names.entries())
    if (legalName(name) && !taken.has(name.toLowerCase())) {
      out[i] = name
      taken.add(name.toLowerCase())
    }
  for (const [i, name] of names.entries()) {
    if (out[i] != null) continue
    const base = name.replace(ILLEGAL, '_').replace(/^'|'$/g, '_').slice(0, 31) || 'Sheet'
    let next = base
    for (let n = 2; taken.has(next.toLowerCase()); n++) {
      const tail = ` (${n})`
      next = base.slice(0, 31 - tail.length) + tail
    }
    taken.add(next.toLowerCase())
    out[i] = next
  }
  return out as string[]
}

/**
 * A list of values written in the rule itself, `"a,b"`, or `null` when it
 * can't be: a value with a comma or a quote would split or end it, and
 * the file holds at most 255 characters.
 */
function inlineList(options: readonly unknown[]) {
  const values = options.map((o) =>
    String(typeof o === 'object' && o !== null ? (o as { value: unknown }).value : o),
  )
  if (values.some((v) => v.includes(',') || v.includes('"'))) return null
  const list = `"${values.join(',')}"`
  return list.length <= 255 ? list : null
}

/** The ranges of a rule, as the file lists them. */
const sqref = (range: string | string[]) =>
  (Array.isArray(range) ? range : [range]).map((r) => r.replaceAll('$', '').trim()).join(' ')

/** The top left cell of a rule's first range, which its formula is written for. */
function anchorOf(range: string | string[]) {
  const first = Array.isArray(range) ? range[0] : range
  const parsed = first ? parseRange(first.replaceAll('$', '')) : null
  if (!parsed) return 'A1'
  const b = boundsOf(parsed)
  return cellName(Number.isFinite(b.top) ? b.top : 0, Number.isFinite(b.left) ? b.left : 0)
}

/** A value in a formula: numbers as they are, dates as day numbers, text in quotes. */
function literal(value: SheetValue | undefined) {
  if (value == null) return '""'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  const serial = dateFormat(value) ? serialOf(value) : null
  if (serial != null) return String(serial)
  return `"${value.replaceAll('"', '""')}"`
}

const formulaText = (formula: string) => (formula.startsWith('=') ? formula.slice(1) : formula)

const CELL_IS: Partial<Record<SheetCondition['op'], string>> = {
  eq: 'equal',
  ne: 'notEqual',
  gt: 'greaterThan',
  ge: 'greaterThanOrEqual',
  lt: 'lessThan',
  le: 'lessThanOrEqual',
  between: 'between',
  notBetween: 'notBetween',
}

/** A tone's soft fill or plain color as the light theme paints it, for scales and bars. */
function toneColor(color: SheetColor, share: number) {
  const tones = ['neutral', 'primary', 'success', 'warning', 'danger']
  if (!tones.includes(color)) return lightThemeColor(color)
  const base = color === 'neutral' ? 'var(--dou-color-text)' : `var(--dou-color-${color})`
  return lightThemeColor(`color-mix(in oklab, ${base} ${share}%, var(--dou-color-bg-surface))`)
}

/** Writes the cells a source exports as an .xlsx file. */
export async function writeXlsx(
  source: SheetFileSource,
  options: SheetXlsxExportOptions = {},
): Promise<Uint8Array> {
  const book = source.book
  if (!source.sheets.length)
    throw new Error('[@dou-ui/sheet-xlsx] a workbook needs at least one sheet to be written')
  const styles = new StyleSheet()
  const strings: string[] = []
  const stringIds = new Map<string, number>()
  let stringCount = 0
  const shared = (text: string) => {
    stringCount++
    let id = stringIds.get(text)
    if (id == null) {
      id = strings.push(text) - 1
      stringIds.set(text, id)
    }
    return id
  }
  const namedStyles = new Map<string, SheetStyle | undefined>()
  const styleNamed = (name: string | undefined) => {
    if (!name) return undefined
    if (!namedStyles.has(name)) {
      const style = book.styles?.[name]
      namedStyles.set(name, style ? plainStyle(style) : undefined)
    }
    return namedStyles.get(name)
  }
  const lookStyle = (style: SheetConditionalStyle) =>
    typeof style === 'string' ? styleNamed(style) : plainStyle(style)

  // a cell's look by its style's name and format, each pair worked out once
  const looks = new Map<string | undefined, Map<string, number>>()
  const lookOf = (name: string | undefined, format: string | undefined, quote: boolean) => {
    let byFormat = looks.get(name)
    if (!byFormat) looks.set(name, (byFormat = new Map()))
    const key = (quote ? "'" : '') + (format ?? '')
    let id = byFormat.get(key)
    if (id == null) {
      id = styles.look({ style: styleNamed(name), format, quote })
      byFormat.set(key, id)
    }
    return id
  }
  // dates repeat a lot in a column: each text's day number and format, worked out once
  const dates = new Map<string, { serial: number; format: string } | null>()
  const dateOf = (text: string) => {
    let date = dates.get(text)
    if (date === undefined) {
      const format = dateFormat(text)
      const serial = format ? serialOf(text) : null
      date = format && serial != null ? { serial, format } : null
      if (dates.size < 100_000) dates.set(text, date)
    }
    return date
  }

  // what `plainCell` gives besides the cell's content, kept out of a new object per cell
  let plainKind: string | undefined
  let plainFormat: string | undefined
  let plainQuote = false
  /** A value's content; its type, format and quoting go to `plainKind`, `plainFormat` and `plainQuote`. */
  function plainCell(value: SheetValue | undefined, format: string | undefined) {
    plainKind = undefined
    plainFormat = format
    plainQuote = false
    if (value == null || value === '') return ''
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return `<v>${value}</v>`
      // what the file can't hold as a number, such as dividing by zero worked out by hand
      plainKind = 'e'
      return '<v>#NUM!</v>'
    }
    if (typeof value === 'boolean') {
      plainKind = 'b'
      return `<v>${value ? 1 : 0}</v>`
    }
    const first = value.charCodeAt(0)
    const date = first >= 48 && first <= 57 ? dateOf(value) : null
    if (date) {
      plainFormat = format ?? date.format
      return `<v>${date.serial}</v>`
    }
    plainKind = 's'
    if (value.startsWith("'=")) {
      plainQuote = true
      return `<v>${shared(value.slice(1))}</v>`
    }
    return `<v>${shared(value)}</v>`
  }

  const selection = source.scope === 'selection'
  const keepFormulas = !selection && options.formulas !== false
  const { colWidth, rowHeight } = source
  const names = sheetNames(source.sheets.map((s) => s.data.name))
  // sheets whose names changed: formulas referring to them follow
  const renamed = new Map<string, string>()
  for (const [i, { data }] of source.sheets.entries())
    if (names[i] !== data.name) renamed.set(data.name, names[i]!)
  const rename = (formula: string) => renameReferencesAll(formula, renamed)
  const entries: ZipEntry[] = []
  const sheetFiles: { name: string; hidden: boolean; filter?: string }[] = []

  const pacing = { signal: source.signal, lastPause: { at: performance.now() } }
  for (const [n, { index, data, bounds }] of source.sheets.entries()) {
    source.signal?.throwIfAborted()
    // the selection goes in at A1; a whole sheet keeps its places
    const top = selection && bounds ? bounds.top : 0
    const left = selection && bounds ? bounds.left : 0
    const last = bounds ? { row: bounds.bottom, col: bounds.right } : { row: -1, col: -1 }
    // column letters, worked out once per column
    const letters: string[] = []
    let rowName = ''
    const at = (_row: number, col: number) => (letters[col] ??= columnName(col - left)) + rowName

    // sizes, hidden lines and groups, by line
    const rowLevels = new Map<number, number>()
    const colLevels = new Map<number, number>()
    const hiddenRows = new Set<number>()
    const hiddenCols = new Set<number>()
    const collapsedRows = new Set<number>()
    const collapsedCols = new Set<number>()
    const after = data.groupSummary === 'after'
    if (!selection)
      for (const group of data.groups ?? []) {
        const parsed = parseRange(group.range)
        if (!parsed) continue
        const b = boundsOf(parsed)
        const rows = b.left === 0 && b.right === Infinity
        const [start, end] = rows ? [b.top, b.bottom] : [b.left, b.right]
        if (!Number.isFinite(end)) continue
        const levels = rows ? rowLevels : colLevels
        for (let i = start; i <= end; i++) levels.set(i, Math.min(7, (levels.get(i) ?? 0) + 1))
        if (group.collapsed) {
          const hidden = rows ? hiddenRows : hiddenCols
          for (let i = start; i <= end; i++) hidden.add(i)
          ;(rows ? collapsedRows : collapsedCols).add(after ? end + 1 : start - 1)
        }
      }
    for (const [key, size] of Object.entries(data.rowSizes ?? {}))
      if (size === 0) hiddenRows.add(+key)
    // rows the filter hides, hidden in the file too: other programs don't filter on opening
    if (!selection)
      for (const row of filteredOut(source, index, data, last.row)) hiddenRows.add(row)
    for (const [key, size] of Object.entries(data.colSizes ?? {}))
      if (size === 0) hiddenCols.add(+key)

    // columns: their widths, hidden ones and groups
    const colList = new Set<number>()
    for (const key of Object.keys(data.colSizes ?? {})) colList.add(+key)
    for (const col of colLevels.keys()) colList.add(col)
    for (const col of hiddenCols) colList.add(col)
    const cols = [...colList]
      .filter((col) => col >= left && (!selection || col <= last.col))
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts the list built here
      .sort((a, b) => a - b)
      .map((col) => {
        const size = data.colSizes?.[col]
        const hidden = hiddenCols.has(col)
        return `<col${attrs({
          min: col - left + 1,
          max: col - left + 1,
          width: widthOf(size || colWidth),
          customWidth: size != null && size > 0 ? 1 : undefined,
          hidden,
          outlineLevel: colLevels.get(col),
          collapsed: collapsedCols.has(col) ? 1 : undefined,
        })}/>`
      })

    // cells, row by row; list cells for the types that pick from a list
    const lists = new Map<string, { values: string; cells: string[] } | null>()
    const notes: { ref: string; row: number; col: number; text: string }[] = []
    const rows: string[] = []
    // the column a cell written next is in without saying so
    let nextCol = left
    // rows past the cells still written for their size, group or being hidden
    let lastRow = last.row
    if (!selection) {
      for (const row of rowLevels.keys()) if (row > lastRow) lastRow = row
      for (const row of hiddenRows) if (row > lastRow) lastRow = row
      for (const key of Object.keys(data.rowSizes ?? {})) if (+key > lastRow) lastRow = +key
    }
    // the rows go into bytes as they are written, so the text of a big sheet isn't held whole
    const chunks: Uint8Array[] = []
    const flush = () => {
      if (rows.length) chunks.push(encoder.encode(rows.join('')))
      rows.length = 0
    }
    for (let row = top; row <= lastRow; row++) {
      const line = data.cells[row]
      rowName = String(row - top + 1)
      let xml = ''
      nextCol = left
      if (line && row <= last.row)
        for (let col = left; col <= last.col && col < line.length; col++) {
          const input = line[col]
          if (input == null) continue
          xml += cellXML(row, col, input)
        }
      const size = data.rowSizes?.[row]
      const level = rowLevels.get(row)
      const hidden = hiddenRows.has(row)
      if (!xml && size == null && !level && !hidden) continue
      if (rows.length >= 1000) {
        flush()
        // a big sheet takes a while: let the page go on and the export be called off
        if (performance.now() - pacing.lastPause.at > SLICE) {
          await pause()
          source.signal?.throwIfAborted()
          pacing.lastPause.at = performance.now()
        }
      }
      rows.push(
        `<row${attrs({
          r: row - top + 1,
          ht: size ? heightOf(size) : undefined,
          customHeight: size ? 1 : undefined,
          hidden,
          outlineLevel: level,
          collapsed: collapsedRows.has(row) ? 1 : undefined,
        })}${xml ? `>${xml}</row>` : '/>'}`,
      )
    }

    function cellXML(row: number, col: number, input: unknown) {
      const cell =
        typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : null
      if (cell && typeof cell.note === 'string' && cell.note)
        notes.push({ ref: at(row, col), row: row - top, col: col - left, text: cell.note })
      const value = source.value(index, row, col)
      const typed = source.cellType(index, row, col)
      let format = cell && typeof cell.format === 'string' ? cell.format : undefined
      const styleName = cell && typeof cell.style === 'string' ? cell.style : undefined

      // a type that picks from a list: its values become the cell's list
      if (typed?.name === 'select' && Array.isArray(typed.setup.options)) {
        const key = cell?.type as string
        let list = lists.get(key)
        if (list === undefined) {
          const values = inlineList(typed.setup.options)
          list = values == null ? null : { values, cells: [] }
          lists.set(key, list)
        }
        list?.cells.push(at(row, col))
      }

      let body = ''
      let kind: string | undefined
      let quote = false
      if (typed?.definition.plain) {
        body = plainCell(source.plain(index, row, col), format)
        kind = plainKind
        format = plainFormat
      } else if (typeof value === 'string' && value.startsWith('=') && value.length > 1) {
        const result = source.result(index, row, col)
        if (isSheetError(result) && result.code === '#ERROR!') {
          // not a formula other programs can read either: kept as its text
          kind = 's'
          body = `<v>${shared(value)}</v>`
        } else if (keepFormulas) {
          body = `<f>${esc(formulaText(rename(value)))}</f>`
          // what it came to; a date as its day number and a date format, as other programs give it
          if (isSheetError(result)) {
            kind = 'e'
            body += `<v>${errorCode(result.code)}</v>`
          } else if (typeof result === 'string') {
            const first = result.charCodeAt(0)
            const date = first >= 48 && first <= 57 ? dateOf(result) : null
            if (date) {
              body += `<v>${date.serial}</v>`
              format ??= date.format
            } else {
              kind = 'str'
              body += `<v>${esc(result)}</v>`
            }
          } else if (result != null) {
            body += plainCell(result, format)
            kind = plainKind
          }
        } else if (isSheetError(result)) {
          kind = 'e'
          body = `<v>${errorCode(result.code)}</v>`
        } else {
          body = plainCell(source.plain(index, row, col), format)
          kind = plainKind
          format = plainFormat
        }
      } else {
        body = plainCell(value, format)
        kind = plainKind
        format = plainFormat
        quote = plainQuote
      }

      const s = styleName || format || quote ? lookOf(styleName, format, quote) : 0
      if (!body && !s) return ''
      // a cell right after the one before goes without its name, which halves the file
      const named = col !== nextCol
      nextCol = col + 1
      return `<c${named ? ` r="${at(row, col)}"` : ''}${s ? ` s="${s}"` : ''}${kind ? ` t="${kind}"` : ''}${body ? `>${body}</c>` : '/>'}`
    }

    // merges inside what is written
    const merges: string[] = []
    for (const merge of data.merges ?? []) {
      const parsed = parseRange(merge)
      if (!parsed) continue
      const b = boundsOf(parsed)
      if (selection && bounds) {
        if (b.top < top || b.left < left || b.bottom > bounds.bottom || b.right > bounds.right)
          continue
      }
      merges.push(
        `<mergeCell ref="${rangeText({ top: b.top - top, left: b.left - left, bottom: b.bottom - top, right: b.right - left })}"/>`,
      )
    }

    const extra = selection ? null : sheetRules(data)
    const freeze =
      !selection && data.freeze && (data.freeze.rows || data.freeze.cols) ? data.freeze : null
    const pane = freeze
      ? `<pane${attrs({
          xSplit: freeze.cols || undefined,
          ySplit: freeze.rows || undefined,
          topLeftCell: cellName(freeze.rows ?? 0, freeze.cols ?? 0),
          activePane:
            freeze.rows && freeze.cols ? 'bottomRight' : freeze.rows ? 'bottomLeft' : 'topRight',
          state: 'frozen',
        })}/>`
      : ''
    const hasLevels = rowLevels.size || colLevels.size

    // a list from a cell type, where the cell has no rule of its own
    const typeLists = [...lists.values()]
      .filter((list) => list != null)
      .map(
        ({ values, cells }) =>
          `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${esc(
            compactRefs(cells),
          )}"><formula1>${esc(values)}</formula1></dataValidation>`,
      )
    const validations = [...typeLists, ...(extra?.validations ?? [])]

    const relsList: string[] = []
    let legacy = ''
    if (notes.length) {
      const id = n + 1
      entries.push({ path: `xl/comments${id}.xml`, data: commentsXML(notes) })
      entries.push({ path: `xl/drawings/vmlDrawing${id}.vml`, data: vmlXML(notes) })
      relsList.push(
        `<Relationship Id="rId1" Type="${NS_R}/comments" Target="../comments${id}.xml"/>`,
        `<Relationship Id="rId2" Type="${NS_R}/vmlDrawing" Target="../drawings/vmlDrawing${id}.vml"/>`,
      )
      legacy = '<legacyDrawing r:id="rId2"/>'
    }

    const lastCell =
      last.row >= top && last.col >= left
        ? rangeText({ top: 0, left: 0, bottom: last.row - top, right: last.col - left })
        : 'A1'
    flush()
    const head =
      `${HEAD}<worksheet xmlns="${NS}" xmlns:r="${NS_R}">` +
      (hasLevels
        ? `<sheetPr><outlinePr${attrs({ summaryBelow: after ? 1 : 0, summaryRight: after ? 1 : 0 })}/></sheetPr>`
        : '') +
      `<dimension ref="${lastCell}"/>` +
      `<sheetViews><sheetView${attrs({ workbookViewId: 0, tabSelected: n === 0 ? 1 : undefined })}>${pane}</sheetView></sheetViews>` +
      `<sheetFormatPr${attrs({
        defaultRowHeight: heightOf(rowHeight),
        defaultColWidth: widthOf(colWidth),
        customHeight: 1,
        outlineLevelRow: maxLevel(rowLevels),
        outlineLevelCol: maxLevel(colLevels),
      })}/>` +
      (cols.length ? `<cols>${cols.join('')}</cols>` : '') +
      '<sheetData>'
    const tail =
      '</sheetData>' +
      (extra?.filter ?? '') +
      (merges.length
        ? `<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>`
        : '') +
      (extra?.conditional ?? '') +
      (validations.length
        ? `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
        : '') +
      legacy +
      '</worksheet>'
    entries.push({
      path: `xl/worksheets/sheet${n + 1}.xml`,
      data: [encoder.encode(head), ...chunks, encoder.encode(tail)],
    })
    if (relsList.length)
      entries.push({
        path: `xl/worksheets/_rels/sheet${n + 1}.xml.rels`,
        data: `${HEAD}<Relationships xmlns="${NS_PKG}">${relsList.join('')}</Relationships>`,
      })
    sheetFiles.push({
      name: names[n]!,
      hidden: false,
      filter: !selection && data.filter ? data.filter.range : undefined,
    })
  }

  /** A sheet's filter, conditional formats and validations. */
  function sheetRules(data: SheetData) {
    let filter = ''
    if (data.filter) {
      const parsed = parseRange(data.filter.range)
      const columns = Object.entries(data.filter.columns ?? {})
        .map(([col, rule]) => {
          const id = +col - (parsed ? boundsOf(parsed).left : 0)
          if ('values' in rule) {
            const blank = rule.values.includes('')
            const values = rule.values
              .filter((v) => v !== '')
              .map((v) => `<filter val="${esc(v)}"/>`)
              .join('')
            return `<filterColumn colId="${id}"><filters${attrs({ blank })}>${values}</filters></filterColumn>`
          }
          const custom = customFilter(rule.condition)
          return custom ? `<filterColumn colId="${id}">${custom}</filterColumn>` : ''
        })
        .join('')
      filter = `<autoFilter ref="${esc(data.filter.range.replaceAll('$', ''))}"${columns ? `>${columns}</autoFilter>` : '/>'}`
    }

    let priority = 0
    const conditional = (data.conditionalFormats ?? [])
      .map((rule) => {
        const xml = conditionalRule(rule, ++priority)
        return xml
          ? `<conditionalFormatting sqref="${esc(sqref(rule.range))}">${xml}</conditionalFormatting>`
          : ''
      })
      .join('')

    const validations = (data.validations ?? [])
      .map((rule) => validationXML(rule, rename))
      .filter(Boolean)
    return { filter, conditional, validations }
  }

  function conditionalRule(rule: SheetConditionalFormat, priority: number) {
    const dxf = () => {
      const look = 'style' in rule && rule.style != null ? lookStyle(rule.style) : undefined
      return look ? styles.differential(look) : undefined
    }
    const anchor = anchorOf(rule.range)
    if ('when' in rule) {
      const { op, value, to } = rule.when
      const cellIs = CELL_IS[op]
      if (cellIs)
        return `<cfRule${attrs({ type: 'cellIs', dxfId: dxf(), priority, operator: cellIs })}><formula>${esc(
          literal(value),
        )}</formula>${op === 'between' || op === 'notBetween' ? `<formula>${esc(literal(to))}</formula>` : ''}</cfRule>`
      const text = String(value ?? '')
      const quoted = literal(text)
      const textRule = (type: string, operator: string | undefined, formula: string) =>
        `<cfRule${attrs({ type, dxfId: dxf(), priority, operator, text: operator ? text : undefined })}><formula>${esc(
          formula,
        )}</formula></cfRule>`
      if (op === 'contains')
        return textRule('containsText', 'containsText', `NOT(ISERROR(SEARCH(${quoted},${anchor})))`)
      if (op === 'notContains')
        return textRule('notContainsText', 'notContains', `ISERROR(SEARCH(${quoted},${anchor}))`)
      if (op === 'begins')
        return textRule('beginsWith', 'beginsWith', `LEFT(${anchor},LEN(${quoted}))=${quoted}`)
      if (op === 'ends')
        return textRule('endsWith', 'endsWith', `RIGHT(${anchor},LEN(${quoted}))=${quoted}`)
      if (op === 'blank') return textRule('containsBlanks', undefined, `LEN(TRIM(${anchor}))=0`)
      if (op === 'notBlank')
        return textRule('notContainsBlanks', undefined, `LEN(TRIM(${anchor}))>0`)
      return ''
    }
    if ('formula' in rule)
      return `<cfRule${attrs({ type: 'expression', dxfId: dxf(), priority })}><formula>${esc(
        formulaText(rename(rule.formula)),
      )}</formula></cfRule>`
    if ('top' in rule || 'bottom' in rule) {
      const rank = rule.top ?? rule.bottom ?? 10
      return `<cfRule${attrs({
        type: 'top10',
        dxfId: dxf(),
        priority,
        percent: rule.percent,
        bottom: rule.bottom != null,
        rank,
      })}/>`
    }
    if ('average' in rule)
      return `<cfRule${attrs({
        type: 'aboveAverage',
        dxfId: dxf(),
        priority,
        aboveAverage: rule.average === 'above' ? undefined : '0',
      })}/>`
    if ('duplicates' in rule)
      return `<cfRule${attrs({ type: 'duplicateValues', dxfId: dxf(), priority })}/>`
    if ('unique' in rule)
      return `<cfRule${attrs({ type: 'uniqueValues', dxfId: dxf(), priority })}/>`
    if ('scale' in rule) {
      const colors = rule.scale.map((c) => argb(toneColor(c, 32)) ?? 'FFFFFFFF')
      const points =
        colors.length === 3
          ? '<cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/>'
          : '<cfvo type="min"/><cfvo type="max"/>'
      return `<cfRule${attrs({ type: 'colorScale', priority })}><colorScale>${points}${colors
        .map((c) => `<color rgb="${c}"/>`)
        .join('')}</colorScale></cfRule>`
    }
    if ('bar' in rule) {
      const color = argb(toneColor(rule.bar === true ? 'neutral' : rule.bar, 30)) ?? 'FF638EC6'
      return `<cfRule${attrs({ type: 'dataBar', priority })}><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${color}"/></dataBar></cfRule>`
    }
    return ''
  }

  // the workbook around the sheets
  const sheetsXML = sheetFiles
    .map((s, i) => `<sheet${attrs({ name: s.name, sheetId: i + 1, 'r:id': `rId${i + 1}` })}/>`)
    .join('')
  const defined = sheetFiles
    .map((s, i) =>
      s.filter
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(
            `${quoteSheet(s.name)}!${absolute(s.filter)}`,
          )}</definedName>`
        : '',
    )
    .join('')
  entries.push({
    path: 'xl/workbook.xml',
    data:
      `${HEAD}<workbook xmlns="${NS}" xmlns:r="${NS_R}">` +
      '<bookViews><workbookView activeTab="0"/></bookViews>' +
      `<sheets>${sheetsXML}</sheets>` +
      (defined ? `<definedNames>${defined}</definedNames>` : '') +
      '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
      '</workbook>',
  })
  const count = sheetFiles.length
  entries.push({
    path: 'xl/_rels/workbook.xml.rels',
    data:
      `${HEAD}<Relationships xmlns="${NS_PKG}">` +
      sheetFiles
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('') +
      `<Relationship Id="rId${count + 1}" Type="${NS_R}/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId${count + 2}" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/>` +
      '</Relationships>',
  })
  entries.push({ path: 'xl/styles.xml', data: styles.toXML() })
  entries.push({
    path: 'xl/sharedStrings.xml',
    data:
      `${HEAD}<sst xmlns="${NS}" count="${stringCount}" uniqueCount="${strings.length}">` +
      strings
        .map(
          (t) => `<si><t${/^\s|\s$|\n/.test(t) ? ' xml:space="preserve"' : ''}>${esc(t)}</t></si>`,
        )
        .join('') +
      '</sst>',
  })
  entries.push({
    path: '_rels/.rels',
    data:
      `${HEAD}<Relationships xmlns="${NS_PKG}">` +
      `<Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/>` +
      '</Relationships>',
  })
  const hasNotes = entries.some((e) => e.path.startsWith('xl/comments'))
  entries.push({
    path: '[Content_Types].xml',
    data:
      `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      (hasNotes
        ? '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>'
        : '') +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheetFiles
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('') +
      entries
        .filter((e) => e.path.startsWith('xl/comments'))
        .map(
          (e) =>
            `<Override PartName="/${e.path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`,
        )
        .join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      '</Types>',
  })
  // the content types first, as some readers expect
  entries.unshift(entries.pop()!)
  source.signal?.throwIfAborted()
  return zip(entries, pacing)
}

/** The rows of a sheet's filter that its rules hide, as the grid hides them. */
function filteredOut(source: SheetFileSource, index: number, data: SheetData, lastRow: number) {
  const out = new Set<number>()
  const parsed = data.filter?.columns && parseRange(data.filter.range)
  if (!parsed) return out
  const b = boundsOf(parsed)
  const rules = Object.entries(data.filter!.columns!)
    .map(([key, rule]) => ({ col: Number(key), rule }))
    .filter(({ col }) => col >= b.left && col <= b.right)
  const collator = textCollator(source.locale)
  for (let row = b.top + 1; row <= Math.min(b.bottom, lastRow); row++)
    for (const { col, rule } of rules) {
      const result = source.result(index, row, col)
      const value = isSheetError(result) ? result.code : result
      const text = value == null || value === '' ? '' : source.text(index, row, col)
      if (!meetsRule(rule, value, text, collator)) {
        out.add(row)
        break
      }
    }
  return out
}

/** Cell names, with runs down a column written as ranges. */
function compactRefs(refs: string[]) {
  const byCol = new Map<string, number[]>()
  for (const ref of refs) {
    const [, col, row] = /^([A-Z]+)(\d+)$/.exec(ref)!
    const list = byCol.get(col!) ?? []
    list.push(+row!)
    byCol.set(col!, list)
  }
  const out: string[] = []
  for (const [col, list] of byCol) {
    list.sort((a, b) => a - b)
    let start = list[0]!
    let prev = start
    for (const row of [...list.slice(1), Infinity]) {
      if (row === prev + 1) {
        prev = row
        continue
      }
      out.push(start === prev ? `${col}${start}` : `${col}${start}:${col}${prev}`)
      start = prev = row
    }
  }
  return out.join(' ')
}

/** A validation as the file writes it, `''` for one it can't hold. */
function validationXML(rule: SheetValidation, rename: (formula: string) => string) {
  const common = {
    allowBlank: 1,
    showErrorMessage: 1,
    showInputMessage: rule.prompt ? 1 : undefined,
    errorStyle: rule.strict === false ? 'warning' : undefined,
    error: rule.message,
    prompt: rule.prompt,
    sqref: sqref(rule.range),
  }
  if ('list' in rule) {
    const list =
      typeof rule.list === 'string' ? formulaText(rename(rule.list)) : inlineList(rule.list)
    if (list == null || list.length > 255) return ''
    return `<dataValidation${attrs({ type: 'list', ...common })}>${body(list)}</dataValidation>`
  }
  if ('formula' in rule)
    return `<dataValidation${attrs({ type: 'custom', ...common })}>${body(formulaText(rename(rule.formula)))}</dataValidation>`
  const { op, value, to } = rule.when
  const operator = CELL_IS[op]
  const numeric = typeof value === 'number' || (typeof value === 'string' && !!dateFormat(value))
  if (operator && numeric) {
    const type = typeof value === 'string' ? 'date' : rule.integer ? 'whole' : 'decimal'
    const formulas =
      op === 'between' || op === 'notBetween' ? [literal(value), literal(to)] : [literal(value)]
    return `<dataValidation${attrs({ type, operator, ...common })}>${body(...formulas)}</dataValidation>`
  }
  // text conditions as a formula on the top left cell
  const anchor = anchorOf(rule.range)
  const quoted = literal(String(value ?? ''))
  const formula: Partial<Record<SheetCondition['op'], string>> = {
    eq: `EXACT(LOWER(${anchor}),LOWER(${quoted}))`,
    ne: `NOT(EXACT(LOWER(${anchor}),LOWER(${quoted})))`,
    contains: `NOT(ISERROR(SEARCH(${quoted},${anchor})))`,
    notContains: `ISERROR(SEARCH(${quoted},${anchor}))`,
    begins: `LEFT(LOWER(${anchor}),LEN(${quoted}))=LOWER(${quoted})`,
    ends: `RIGHT(LOWER(${anchor}),LEN(${quoted}))=LOWER(${quoted})`,
    notBlank: `LEN(TRIM(${anchor}))>0`,
  }
  const custom = formula[op]
  return custom
    ? `<dataValidation${attrs({ type: 'custom', ...common })}>${body(custom)}</dataValidation>`
    : ''
}
/** A validation's formulas. */
const body = (...formulas: string[]) =>
  formulas.map((f, i) => `<formula${i + 1}>${esc(f)}</formula${i + 1}>`).join('')

/** One condition of a custom filter. */
const one = (operator: string | undefined, val: string) =>
  `<customFilter${attrs({ operator, val })}/>`

/** A filter's condition as the file's custom filter, `''` when it has none. */
function customFilter(condition: SheetCondition) {
  const value = condition.value == null ? '' : String(condition.value)
  switch (condition.op) {
    case 'eq':
      return `<customFilters>${one(undefined, value)}</customFilters>`
    case 'ne':
      return `<customFilters>${one('notEqual', value)}</customFilters>`
    case 'gt':
      return `<customFilters>${one('greaterThan', value)}</customFilters>`
    case 'ge':
      return `<customFilters>${one('greaterThanOrEqual', value)}</customFilters>`
    case 'lt':
      return `<customFilters>${one('lessThan', value)}</customFilters>`
    case 'le':
      return `<customFilters>${one('lessThanOrEqual', value)}</customFilters>`
    case 'between':
      return `<customFilters and="1">${one('greaterThanOrEqual', value)}${one('lessThanOrEqual', String(condition.to ?? ''))}</customFilters>`
    case 'notBetween':
      return `<customFilters>${one('lessThan', value)}${one('greaterThan', String(condition.to ?? ''))}</customFilters>`
    case 'contains':
      return `<customFilters>${one(undefined, `*${value}*`)}</customFilters>`
    case 'notContains':
      return `<customFilters>${one('notEqual', `*${value}*`)}</customFilters>`
    case 'begins':
      return `<customFilters>${one(undefined, `${value}*`)}</customFilters>`
    case 'ends':
      return `<customFilters>${one(undefined, `*${value}`)}</customFilters>`
    case 'blank':
      return '<filters blank="1"/>'
    case 'notBlank':
      return `<customFilters>${one('notEqual', ' ')}</customFilters>`
    default:
      return ''
  }
}

const absolute = (range: string) =>
  range
    .replaceAll('$', '')
    .split(':')
    .map((ref) => ref.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2'))
    .join(':')

/** The notes of a sheet as the file's comments. */
function commentsXML(notes: { ref: string; text: string }[]) {
  return (
    `${HEAD}<comments xmlns="${NS}"><authors><author></author></authors><commentList>` +
    notes
      .map(
        (note) =>
          `<comment ref="${note.ref}" authorId="0"><text><t xml:space="preserve">${esc(note.text)}</t></text></comment>`,
      )
      .join('') +
    '</commentList></comments>'
  )
}

/** The boxes notes show in, which other programs need to show them. */
function vmlXML(notes: { row: number; col: number }[]) {
  return (
    '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>' +
    '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>' +
    notes
      .map(
        (note, i) =>
          `<v:shape id="_x0000_s${1025 + i}" type="#_x0000_t202" style="position:absolute;margin-left:80pt;margin-top:2pt;width:120pt;height:60pt;z-index:${i + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">` +
          '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/>' +
          '<v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>' +
          `<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:AutoFill>False</x:AutoFill><x:Row>${note.row}</x:Row><x:Column>${note.col}</x:Column></x:ClientData>` +
          '</v:shape>',
      )
      .join('') +
    '</xml>'
  )
}
