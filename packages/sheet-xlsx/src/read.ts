import {
  columnName,
  parseCell,
  shiftFormula,
  type SheetCell,
  type SheetCondition,
  type SheetConditionalFormat,
  type SheetData,
  type SheetFilterRule,
  type SheetImportResult,
  type SheetImportWarning,
  type SheetRuleRange,
  type SheetStyle,
  type SheetValidation,
  type SheetValue,
  type SheetWorkbook,
} from '@dou-ui/sheet/core'
import { dateText } from '@dou-ui/sheet/formula'
import { sheetXlsxMessagesFor, type SheetXlsxMessages, type SheetXlsxWarningCode } from './messages'
import { colorOf, readStyles, themeColors, type CellLookIn } from './read-styles'
import {
  attrsOf,
  childOf,
  childrenOf,
  isNotOff,
  isOn,
  parseXml,
  XmlReader,
  type XmlNode,
} from './xml-read'
import { pause, SLICE, zipFiles, type ZipFile, type ZipPacing } from './zip'

/** Options of reading an .xlsx file. */
export interface SheetXlsxImportOptions {
  /**
   * Reads formulas; `false` reads only what they came to when the file was
   * saved, e.g. for formulas with functions this sheet doesn't have. `true`
   * by default.
   */
  formulas?: boolean
}

/** What `readXlsx` takes besides the file. */
export interface SheetXlsxReadOptions extends SheetXlsxImportOptions {
  /** The language of the warnings and of why a file couldn't be read. */
  locale?: string
  /** Texts to use instead, in part. */
  messages?: Partial<SheetXlsxMessages>
  signal?: AbortSignal
}

const decoder = new TextDecoder()

/** Column widths: the characters the file counts in to px. */
const pxOfWidth = (width: number) => Math.round(width * 7 + 5)
/** Row heights: points to px. */
const pxOfHeight = (points: number) => Math.round(points / 0.75)

/** A path a relationship points to, from the part it is in. */
function resolvePath(from: string, target: string) {
  if (target.startsWith('/')) return target.slice(1)
  const parts = from.split('/').slice(0, -1)
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop()
    else if (piece !== '.') parts.push(piece)
  }
  return parts.join('/')
}

/** Where a part's relationships are: `xl/workbook.xml` keeps them in `xl/_rels/workbook.xml.rels`. */
const relsPath = (part: string) => {
  const slash = part.lastIndexOf('/')
  return `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`
}

/** Text of a run of text: `<t>`, or the `<t>` of each `<r>`. Phonetic guides are left out. */
function textOf(node: XmlNode): string {
  let out = ''
  for (const child of node.children)
    if (child.name === 't') out += child.text
    else if (child.name === 'r') out += textOf(child)
  return out
}

/** Text the file escapes as `_x000D_`, back to its characters. */
const unescapeX = (text: string) =>
  text.includes('_x')
    ? text.replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    : text

/** A formula as the sheet writes it: with `=`, without the prefixes of newer functions. */
const formulaOf = (text: string) => `=${text.replace(/_xl(?:fn|ws)\./g, '')}`

/** A value written in a rule's formula: a number, text in quotes, `TRUE` or `FALSE`; `undefined` otherwise. */
function literalOf(formula: string | undefined): SheetValue | undefined {
  if (formula == null) return undefined
  const text = formula.trim()
  if (/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return Number(text)
  if (/^"(?:[^"]|"")*"$/.test(text)) return text.slice(1, -1).replaceAll('""', '"')
  if (/^true$/i.test(text)) return true
  if (/^false$/i.test(text)) return false
  return undefined
}

/** A rule's cells as the sheet writes them: one range, or several. */
function rangesOf(sqref: string | undefined): SheetRuleRange | null {
  const list = (sqref ?? '').trim().split(/\s+/).filter(Boolean)
  if (!list.length) return null
  return list.length === 1 ? list[0]! : list
}

/** The top left cell of a rule's first range, which its formula is written for. */
function anchorOf(range: SheetRuleRange) {
  const first = (Array.isArray(range) ? range[0]! : range).split(':')[0]!
  return first.replaceAll('$', '')
}

const CELL_IS: Record<string, SheetCondition['op']> = {
  equal: 'eq',
  notEqual: 'ne',
  greaterThan: 'gt',
  greaterThanOrEqual: 'ge',
  lessThan: 'lt',
  lessThanOrEqual: 'le',
  between: 'between',
  notBetween: 'notBetween',
}
const COMPARE: Partial<Record<SheetCondition['op'], string>> = {
  eq: '=',
  ne: '<>',
  gt: '>',
  ge: '>=',
  lt: '<',
  le: '<=',
}

/** Where the first relationship of a kind points. */
const ofType = (rels: Map<string, { path: string; type: string }>, type: string) =>
  [...rels.values()].find((rel) => rel.type.endsWith(`/${type}`))?.path

/** Reads the file's warnings up, by what was lost and on which sheet. */
class Warnings {
  private list = new Map<string, SheetImportWarning>()
  constructor(private readonly messages: SheetXlsxMessages) {}
  add(code: SheetXlsxWarningCode, sheet?: string, count = 1) {
    if (count <= 0) return
    const key = `${code}\u0000${sheet ?? ''}`
    const warning = this.list.get(key)
    if (warning) warning.count = (warning.count ?? 1) + count
    else
      this.list.set(key, {
        code,
        message: this.messages.warnings[code],
        count,
        ...(sheet == null ? {} : { sheet }),
      })
  }
  get all() {
    return [...this.list.values()]
  }
}

/**
 * Reads an .xlsx file as a workbook: values, formulas, number formats,
 * styles, merges, frozen panes, sizes, hidden rows and columns, groups,
 * notes, data validations, conditional formats and filters. What it can't
 * bring over, such as borders or charts, is listed in `warnings`.
 */
export async function readXlsx(
  file: Blob | ArrayBuffer | Uint8Array,
  options: SheetXlsxReadOptions = {},
): Promise<SheetImportResult & { warnings: SheetImportWarning[] }> {
  const messages = { ...sheetXlsxMessagesFor(options.locale), ...options.messages }
  const { signal } = options
  const bytes =
    file instanceof Uint8Array
      ? file
      : new Uint8Array(file instanceof ArrayBuffer ? file : await file.arrayBuffer())
  signal?.throwIfAborted()
  // a file with a password is kept in another kind of container
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)
    throw new Error(messages.locked)
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(messages.notXlsx)
  let files: Map<string, ZipFile>
  try {
    files = zipFiles(bytes)
  } catch (error) {
    throw new Error(messages.damaged, { cause: error })
  }
  const pacing: ZipPacing = { signal, lastPause: { at: performance.now() } }
  const readText = async (path: string) => {
    const entry = files.get(path)
    if (!entry) return undefined
    try {
      return decoder.decode(await entry.read(pacing))
    } catch (error) {
      if (signal?.aborted || String(error).includes('CompressionStream')) throw error
      throw new Error(messages.damaged, { cause: error })
    }
  }
  const readNode = async (path: string | undefined) => {
    const text = path ? await readText(path) : undefined
    return text == null ? undefined : parseXml(text)
  }
  /** A part's relationships by id: where each points and what kind it is. */
  const relsOf = async (part: string) => {
    const out = new Map<string, { path: string; type: string; external: boolean }>()
    const rels = await readNode(relsPath(part))
    for (const rel of childrenOf(rels, 'Relationship')) {
      const external = rel.attrs.TargetMode === 'External'
      out.set(rel.attrs.Id ?? '', {
        path: external ? (rel.attrs.Target ?? '') : resolvePath(part, rel.attrs.Target ?? ''),
        type: rel.attrs.Type ?? '',
        external,
      })
    }
    return out
  }

  const root = await relsOf('')
  const workbookPath =
    [...root.values()].find((rel) => rel.type.endsWith('/officeDocument'))?.path ??
    'xl/workbook.xml'
  const workbook = await readNode(workbookPath)
  if (!workbook || workbook.name !== 'workbook') throw new Error(messages.notXlsx)
  const workbookRels = await relsOf(workbookPath)
  const warnings = new Warnings(messages)

  const theme = themeColors(await readNode(ofType(workbookRels, 'theme')))
  const { looks, differentials } = readStyles(await readNode(ofType(workbookRels, 'styles')), theme)

  // shared strings, and whether any had formatting in parts
  const strings: string[] = []
  const stringsXML = await readNode(ofType(workbookRels, 'sharedStrings'))
  const richText = new Set<number>()
  for (const [i, si] of childrenOf(stringsXML, 'si').entries()) {
    strings.push(unescapeX(textOf(si)))
    if (si.children.some((child) => child.name === 'r' && childOf(child, 'rPr'))) richText.add(i)
  }

  // whole-workbook things the sheet doesn't have
  for (const path of files.keys()) {
    if (/^xl\/vbaProject\.bin$/i.test(path)) warnings.add('macro')
    if (/^xl\/pivotTables\/[^/]+\.xml$/i.test(path)) warnings.add('pivot')
  }
  for (const name of childrenOf(childOf(workbook, 'definedNames'), 'definedName'))
    if (!name.attrs.name?.startsWith('_xlnm.')) warnings.add('name')

  // named styles, one for each different look the cells use
  const styleNames = new Map<string, string>()
  const styles: Record<string, SheetStyle> = {}
  const styleName = (look: CellLookIn) => {
    if (!look.key) return undefined
    let name = styleNames.get(look.key)
    if (!name) {
      name = `style${styleNames.size + 1}`
      styleNames.set(look.key, name)
      styles[name] = look.style!
    }
    return name
  }

  const sheets: SheetData[] = []
  const keepFormulas = options.formulas !== false
  for (const sheetNode of childrenOf(childOf(workbook, 'sheets'), 'sheet')) {
    signal?.throwIfAborted()
    const name = sheetNode.attrs.name ?? `Sheet${sheets.length + 1}`
    const rel = workbookRels.get(sheetNode.attrs.id ?? '')
    if (!rel || !rel.type.endsWith('/worksheet')) {
      // a sheet that is only a chart
      if (rel?.type.endsWith('/chartsheet')) warnings.add('chart', name)
      continue
    }
    if (sheetNode.attrs.state === 'hidden' || sheetNode.attrs.state === 'veryHidden')
      warnings.add('hiddenSheet', name)
    const xml = await readText(rel.path)
    if (xml == null) throw new Error(messages.damaged)
    const sheetRels = await relsOf(rel.path)
    const data = await readSheet(xml, name, {
      strings,
      richText,
      looks,
      differentials,
      styleName,
      keepFormulas,
      warnings,
      pacing,
    })
    // notes, kept in another part
    const comments = await readNode(ofType(sheetRels, 'comments'))
    if (comments) addNotes(data, comments)
    for (const { type, path } of sheetRels.values()) {
      if (type.endsWith('/drawing')) {
        const drawing = await relsOf(path)
        for (const { type: kind } of drawing.values())
          if (kind.endsWith('/chart')) warnings.add('chart', name)
          else if (kind.endsWith('/image')) warnings.add('image', name)
      }
      if (type.endsWith('/pivotTable')) warnings.add('pivot', name)
    }
    sheets.push(data)
  }
  if (!sheets.length) sheets.push({ name: 'Sheet1', cells: [] })
  const book: SheetWorkbook = { sheets }
  if (styleNames.size) book.styles = styles
  signal?.throwIfAborted()
  return { book, warnings: warnings.all }
}

interface SheetContext {
  strings: string[]
  richText: Set<number>
  looks: CellLookIn[]
  differentials: SheetStyle[]
  styleName: (look: CellLookIn) => string | undefined
  keepFormulas: boolean
  warnings: Warnings
  pacing: ZipPacing
}

/** One sheet's part, read a piece at a time. */
async function readSheet(xml: string, name: string, context: SheetContext): Promise<SheetData> {
  const { strings, richText, looks, differentials, styleName, keepFormulas, warnings, pacing } =
    context
  const data: SheetData = { name, cells: [] }
  const cells = data.cells
  const rowSizes: Record<number, number> = {}
  const hiddenRows = new Set<number>()
  const rowLevels = new Map<number, number>()
  const colSizes: Record<number, number> = {}
  const hiddenCols = new Set<number>()
  const colLevels = new Map<number, number>()
  const merges: string[] = []
  let summaryAfter = true
  let borders = 0
  let fonts = 0
  let rich = 0
  let external = 0
  let links = 0
  const dates = new Map<number, string>()
  const times = new Map<number, string>()
  // shared formulas by number: their text and the cell they were written for
  const sharedFormulas = new Map<string, { formula: string; row: number; col: number }>()

  // the cell being read
  let row = -1
  let col = -1
  let kind = ''
  let look: CellLookIn | undefined
  let value = ''
  let inlineText = ''
  let formula: string | null = null
  let formulaAttrs: Record<string, string> | null = null
  let reading: 'v' | 'f' | 't' | null = null
  let inInline = false
  let inPhonetic = false
  // where we are outside the cells
  let skip = 0
  type FilterState = { range: string; left: number; columns: Record<number, SheetFilterRule> }
  // set while reading, out of the type checker's sight
  let filter = null as FilterState | null
  let filterCol: {
    id: number
    values: string[]
    blank: boolean
    custom: { op?: string; val: string }[]
    and: boolean
    other: boolean
  } | null = null
  const conditional: { priority: number; rule: SheetConditionalFormat }[] = []
  let cfRange: SheetRuleRange | null = null
  let cfRule: {
    attrs: Record<string, string>
    formulas: string[]
    colors: (string | undefined)[]
  } | null = null
  const validations: SheetValidation[] = []
  let validation: { attrs: Record<string, string>; formula1?: string; formula2?: string } | null =
    null
  let text = ''

  const finishCell = () => {
    let content: SheetValue = null
    if (kind === 's') {
      const index = +value
      content = strings[index] ?? ''
      if (richText.has(index)) rich++
    } else if (kind === 'inlineStr') content = unescapeX(inlineText)
    else if (kind === 'str') content = unescapeX(value)
    else if (kind === 'b') content = isOn(value)
    else if (kind === 'e') content = value
    else if (kind === 'd') {
      const date = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?))?/.exec(value)
      content = date
        ? date[2] && date[2] !== '00:00:00'
          ? `${date[1]} ${date[2].replace(/:00$/, '')}`
          : date[1]!
        : value
    } else if (value !== '') {
      const number = Number(value)
      content = Number.isFinite(number) ? number : value
    }

    // text that reads as a formula stays text
    if (typeof content === 'string' && content.startsWith('=') && !formula) content = `'${content}`
    let format = look?.format
    if (typeof content === 'number' && look && look.kind !== 'number') {
      const serial = content
      const time = look.kind === 'time' && serial < 1
      // dates repeat a lot in a column: each one's text worked out once
      let shown = (time ? times : dates).get(serial)
      if (shown == null) {
        shown = time ? timeText(serial) : dateText(serial)
        if (dates.size + times.size < 100_000) (time ? times : dates).set(serial, shown)
      }
      content = shown
      // the format the sheet gives such a date anyway isn't kept
      if (format && sameAsPlain(format, content)) format = undefined
    }
    // some programs write TRUE and FALSE as the functions that give them
    if (kind === 'b' && formula != null && /^(TRUE|FALSE)\(\)$/i.test(formula)) formula = null
    if (formula != null && keepFormulas) {
      if (/\[\d+\]/.test(formula)) external++
      else content = formulaOf(formula)
    }
    if (look?.border) borders++
    if (look?.font) fonts++
    const style = look ? styleName(look) : undefined
    if (content === null && !style && !format) return
    const line = (cells[row] ??= [])
    line[col] = style || format ? compact({ value: content, style, format }) : content
  }

  const handler = {
    open(tag: string, raw: string, empty: boolean) {
      if (skip) {
        if (!empty) skip++
        return
      }
      switch (tag) {
        case 'extLst':
        case 'sheetProtection':
          if (!empty) skip = 1
          return
        case 'row': {
          const a = attrsOf(raw)
          row = a.r ? +a.r - 1 : row + 1
          col = -1
          if (isOn(a.customHeight) && a.ht) rowSizes[row] = pxOfHeight(+a.ht)
          if (isOn(a.hidden)) hiddenRows.add(row)
          if (a.outlineLevel && +a.outlineLevel > 0) rowLevels.set(row, +a.outlineLevel)
          break
        }
        case 'c': {
          const a = attrsOf(raw)
          if (a.r) {
            const point = parseCell(a.r)
            if (point) {
              row = point.row
              col = point.col
            } else col++
          } else col++
          kind = a.t ?? 'n'
          look = a.s ? looks[+a.s] : looks[0]
          if (look && !look.style && !look.format && !look.border && !look.font && !look.quote)
            look = undefined
          value = ''
          inlineText = ''
          formula = null
          formulaAttrs = null
          if (empty) finishCell()
          break
        }
        case 'v':
          reading = 'v'
          value = ''
          break
        case 'f':
          formulaAttrs = attrsOf(raw)
          reading = 'f'
          formula = ''
          if (empty) closeFormula()
          break
        case 'is':
          inInline = true
          break
        case 'rPh':
          inPhonetic = true
          break
        case 't':
          if (inInline && !inPhonetic) reading = 't'
          else text = ''
          break
        case 'outlinePr': {
          const a = attrsOf(raw)
          summaryAfter = isNotOff(a.summaryBelow)
          break
        }
        case 'pane': {
          const a = attrsOf(raw)
          if (a.state === 'frozen' || a.state === 'frozenSplit') {
            const rows = Math.round(+(a.ySplit ?? 0))
            const cols = Math.round(+(a.xSplit ?? 0))
            if (rows || cols) data.freeze = { ...(rows ? { rows } : {}), ...(cols ? { cols } : {}) }
          }
          break
        }
        case 'col': {
          const a = attrsOf(raw)
          const min = +(a.min ?? 1) - 1
          const max = Math.min(+(a.max ?? a.min ?? 1) - 1, 16_383)
          const hidden = isOn(a.hidden)
          const level = a.outlineLevel ? +a.outlineLevel : 0
          // a width for all the columns at once is the sheet's, not theirs
          const sized = isOn(a.customWidth) && a.width != null && max - min < 256
          for (let c = min; c <= max; c++) {
            if (sized) colSizes[c] = pxOfWidth(+a.width!)
            if (hidden) hiddenCols.add(c)
            if (level > 0) colLevels.set(c, level)
          }
          break
        }
        case 'mergeCell': {
          const ref = attrsOf(raw).ref
          if (ref) merges.push(ref)
          break
        }
        case 'autoFilter': {
          const ref = attrsOf(raw).ref
          if (ref) {
            const start = parseCell(ref.split(':')[0]!)
            filter = { range: ref, left: start?.col ?? 0, columns: {} }
          }
          break
        }
        case 'filterColumn':
          filterCol = {
            id: +(attrsOf(raw).colId ?? 0),
            values: [],
            blank: false,
            custom: [],
            and: false,
            other: false,
          }
          break
        case 'filters':
          if (filterCol) filterCol.blank = isOn(attrsOf(raw).blank)
          break
        case 'filter':
          filterCol?.values.push(attrsOf(raw).val ?? '')
          break
        case 'customFilters':
          if (filterCol) filterCol.and = isOn(attrsOf(raw).and)
          break
        case 'customFilter': {
          const a = attrsOf(raw)
          filterCol?.custom.push({ op: a.operator, val: a.val ?? '' })
          break
        }
        case 'top10':
        case 'dynamicFilter':
        case 'colorFilter':
        case 'iconFilter':
        case 'dateGroupItem':
          if (filterCol) filterCol.other = true
          break
        case 'conditionalFormatting':
          cfRange = rangesOf(attrsOf(raw).sqref)
          break
        case 'cfRule':
          cfRule = { attrs: attrsOf(raw), formulas: [], colors: [] }
          if (empty) closeRule()
          break
        case 'formula':
        case 'formula1':
        case 'formula2':
          text = ''
          break
        case 'color':
          if (cfRule)
            cfRule.colors.push(
              colorOf({ name: 'color', attrs: attrsOf(raw), children: [], text: '' }, []),
            )
          break
        case 'dataValidation':
          validation = { attrs: attrsOf(raw) }
          if (empty) closeValidation()
          break
        case 'hyperlink':
          links++
          break
      }
    },
    close(tag: string) {
      if (skip) {
        skip--
        return
      }
      switch (tag) {
        case 'c':
          finishCell()
          break
        case 'v':
        case 't':
          if (reading === 'v' || reading === 't') reading = null
          break
        case 'f':
          closeFormula()
          break
        case 'is':
          inInline = false
          break
        case 'rPh':
          inPhonetic = false
          break
        case 'formula':
          cfRule?.formulas.push(text)
          break
        case 'formula1':
          if (validation) validation.formula1 = text
          break
        case 'formula2':
          if (validation) validation.formula2 = text
          break
        case 'filterColumn':
          closeFilterColumn()
          break
        case 'cfRule':
          closeRule()
          break
        case 'dataValidation':
          closeValidation()
          break
      }
    },
    text(chunk: string) {
      if (skip) return
      if (reading === 'v') value += chunk
      else if (reading === 'f') formula += chunk
      else if (reading === 't') inlineText += chunk
      else text += chunk
    },
  }

  function closeFormula() {
    reading = null
    const a = formulaAttrs ?? {}
    let written = formula ?? ''
    if (a.t === 'shared' && a.si != null) {
      const master = sharedFormulas.get(a.si)
      if (written) sharedFormulas.set(a.si, { formula: written, row, col })
      else if (master)
        written = shiftFormula(`=${master.formula}`, row - master.row, col - master.col).slice(1)
    }
    // a table of what-ifs: only its results come over
    formula = written && a.t !== 'dataTable' ? written : null
  }

  function closeFilterColumn() {
    const column = filterCol
    filterCol = null
    if (!filter || !column) return
    const at = filter.left + column.id
    if (column.other) {
      warnings.add('filter', name)
      return
    }
    if (column.values.length || column.blank) {
      filter.columns[at] = { values: [...column.values, ...(column.blank ? [''] : [])] }
      return
    }
    const condition = filterCondition(column.custom, column.and)
    if (condition) filter.columns[at] = { condition }
    else if (column.custom.length) warnings.add('filter', name)
  }

  function closeRule() {
    const rule = cfRule
    cfRule = null
    if (!rule || !cfRange) return
    const made = conditionalOf(rule, cfRange, differentials)
    if (made) conditional.push({ priority: +(rule.attrs.priority ?? 0), rule: made })
    else warnings.add('conditional', name)
  }

  function closeValidation() {
    const rule = validation
    validation = null
    if (!rule) return
    const made = validationOf(rule)
    if (made) validations.push(made)
    else if (rule.attrs.type && rule.attrs.type !== 'none') warnings.add('validation', name)
  }

  const reader = new XmlReader(xml, handler)
  while (reader.step(20_000)) {
    if (performance.now() - pacing.lastPause.at > SLICE) {
      await pause()
      pacing.signal?.throwIfAborted()
      pacing.lastPause.at = performance.now()
    }
  }

  // rows a filter hides aren't hidden for good: the filter hides them again
  const filtered = filter && Object.keys(filter.columns).length ? filter : null
  const filterRows = filtered ? rowSpan(filtered.range) : null
  const rowGroups = groupsOf(rowLevels, hiddenRows, (a, b) => `${a + 1}:${b + 1}`)
  const colGroups = groupsOf(colLevels, hiddenCols, (a, b) => `${columnName(a)}:${columnName(b)}`)
  for (const r of hiddenRows) {
    if (rowGroups.folded.has(r)) continue
    if (filterRows && r > filterRows[0] && r <= filterRows[1]) continue
    rowSizes[r] = 0
  }
  for (const c of hiddenCols) if (!colGroups.folded.has(c)) colSizes[c] = 0

  if (Object.keys(rowSizes).length) data.rowSizes = rowSizes
  if (Object.keys(colSizes).length) data.colSizes = colSizes
  if (merges.length) data.merges = merges
  const groups = [...rowGroups.groups, ...colGroups.groups]
  if (groups.length) {
    data.groups = groups
    if (!summaryAfter) data.groupSummary = 'before'
    else data.groupSummary = 'after'
  }
  if (filter)
    data.filter = Object.keys(filter.columns).length
      ? { range: filter.range, columns: filter.columns }
      : { range: filter.range }
  if (conditional.length)
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the list built here
    data.conditionalFormats = conditional.sort((a, b) => a.priority - b.priority).map((c) => c.rule)
  if (validations.length) data.validations = validations
  warnings.add('border', name, borders)
  warnings.add('font', name, fonts)
  warnings.add('richText', name, rich)
  warnings.add('external', name, external)
  warnings.add('hyperlink', name, links)
  return data
}

/** A cell with only what it has. */
function compact(cell: SheetCell): SheetCell {
  const out: SheetCell = {}
  if (cell.value != null) out.value = cell.value
  if (cell.style) out.style = cell.style
  if (cell.format) out.format = cell.format
  return out
}

/** Whether a date's format is the one the sheet would show it with anyway. */
function sameAsPlain(format: string, text: string) {
  const plain =
    text.length === 10
      ? 'yyyy-mm-dd'
      : text.length === 5
        ? 'hh:mm'
        : text.length === 8
          ? 'hh:mm:ss'
          : text.length === 16
            ? 'yyyy-mm-dd hh:mm'
            : 'yyyy-mm-dd hh:mm:ss'
  return format.toLowerCase() === plain
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A part of a day as `hh:mm`, or `hh:mm:ss` with seconds. */
function timeText(fraction: number) {
  const seconds = Math.round(fraction * 86_400) % 86_400
  const time = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}`
  return seconds % 60 ? `${time}:${pad(seconds % 60)}` : time
}

/** The first and last row of a range such as `A1:E40`. */
function rowSpan(range: string): [number, number] | null {
  const [from, to] = range.split(':')
  const start = from ? parseCell(from) : null
  const end = to ? parseCell(to) : start
  return start && end ? [start.row, end.row] : null
}

/**
 * The groups of lines with outline levels: each run of lines at a level or
 * deeper is a group. A group whose lines are all hidden is folded.
 */
function groupsOf(
  levels: Map<number, number>,
  hidden: Set<number>,
  rangeOf: (start: number, end: number) => string,
) {
  const groups: { range: string; collapsed?: boolean }[] = []
  const folded = new Set<number>()
  if (!levels.size) return { groups, folded }
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the list built here
  const lines = [...levels.keys()].sort((a, b) => a - b)
  let deepest = 0
  for (const level of levels.values()) if (level > deepest) deepest = level
  for (let level = 1; level <= deepest; level++) {
    let start = -1
    let prev = -2
    const close = () => {
      if (start < 0) return
      let all = true
      for (let i = start; i <= prev; i++) if (!hidden.has(i)) all = false
      if (all) for (let i = start; i <= prev; i++) folded.add(i)
      groups.push(
        all ? { range: rangeOf(start, prev), collapsed: true } : { range: rangeOf(start, prev) },
      )
    }
    for (const line of lines) {
      if (levels.get(line)! < level) continue
      if (line !== prev + 1) {
        close()
        start = line
      }
      prev = line
    }
    close()
  }
  return { groups, folded }
}

/** A value typed in a filter or a list: a number when it reads as one. */
const typedValue = (val: string): SheetValue =>
  /^-?(\d+\.?\d*|\.\d+)$/.test(val.trim()) ? Number(val) : val

/** A filter's custom conditions as one condition, `null` when the sheet has none like them. */
function filterCondition(
  custom: { op?: string; val: string }[],
  and: boolean,
): SheetCondition | null {
  if (custom.length === 1) {
    const { op = 'equal', val } = custom[0]!
    const wild = /^\*(.*)\*$/.exec(val)
    if (op === 'equal' || op === 'notEqual') {
      const not = op === 'notEqual'
      if (not && val === ' ') return { op: 'notBlank' }
      if (wild && !wild[1]!.includes('*'))
        return { op: not ? 'notContains' : 'contains', value: wild[1]! }
      if (!not && /^[^*]+\*$/.test(val)) return { op: 'begins', value: val.slice(0, -1) }
      if (!not && /^\*[^*]+$/.test(val)) return { op: 'ends', value: val.slice(1) }
      if (val.includes('*') || val.includes('?')) return null
      return { op: not ? 'ne' : 'eq', value: typedValue(val) }
    }
    const ops: Record<string, SheetCondition['op']> = {
      greaterThan: 'gt',
      greaterThanOrEqual: 'ge',
      lessThan: 'lt',
      lessThanOrEqual: 'le',
    }
    return ops[op] ? { op: ops[op], value: typedValue(val) } : null
  }
  if (custom.length === 2) {
    const [a, b] = custom as [{ op?: string; val: string }, { op?: string; val: string }]
    if (and && a.op === 'greaterThanOrEqual' && b.op === 'lessThanOrEqual')
      return { op: 'between', value: typedValue(a.val), to: typedValue(b.val) }
    if (!and && a.op === 'lessThan' && b.op === 'greaterThan')
      return { op: 'notBetween', value: typedValue(a.val), to: typedValue(b.val) }
  }
  return null
}

/** A conditional format's rule as the sheet's, `null` for one it has none like. */
function conditionalOf(
  rule: { attrs: Record<string, string>; formulas: string[]; colors: (string | undefined)[] },
  range: SheetRuleRange,
  differentials: SheetStyle[],
): SheetConditionalFormat | null {
  const { attrs, formulas } = rule
  const style = differentials[+(attrs.dxfId ?? -1)] ?? {}
  const anchor = anchorOf(range)
  switch (attrs.type) {
    case 'cellIs': {
      const op = CELL_IS[attrs.operator ?? 'between']
      if (!op) return null
      const value = literalOf(formulas[0])
      const to = literalOf(formulas[1])
      const two = op === 'between' || op === 'notBetween'
      if (value !== undefined && (!two || to !== undefined))
        return { range, when: two ? { op, value, to } : { op, value }, style }
      // compared with other cells: as a formula on the top left cell
      if (!formulas[0]) return null
      if (two) {
        if (!formulas[1]) return null
        const inside = `AND(${anchor}>=${formulas[0]},${anchor}<=${formulas[1]})`
        return { range, formula: `=${op === 'between' ? inside : `NOT(${inside})`}`, style }
      }
      return { range, formula: `=${anchor}${COMPARE[op]}${formulas[0]}`, style }
    }
    case 'containsText':
    case 'notContainsText':
    case 'beginsWith':
    case 'endsWith': {
      const ops = {
        containsText: 'contains',
        notContainsText: 'notContains',
        beginsWith: 'begins',
        endsWith: 'ends',
      } as const
      if (attrs.text == null) break
      return { range, when: { op: ops[attrs.type], value: attrs.text }, style }
    }
    case 'containsBlanks':
      return { range, when: { op: 'blank' }, style }
    case 'notContainsBlanks':
      return { range, when: { op: 'notBlank' }, style }
    case 'expression':
      return formulas[0] ? { range, formula: formulaOf(formulas[0]), style } : null
    case 'top10': {
      const rank = +(attrs.rank ?? 10)
      const percent = isOn(attrs.percent) ? { percent: true } : {}
      return isOn(attrs.bottom)
        ? { range, bottom: rank, ...percent, style }
        : { range, top: rank, ...percent, style }
    }
    case 'aboveAverage':
      if (attrs.stdDev != null) return null
      return { range, average: !isNotOff(attrs.aboveAverage) ? 'below' : 'above', style }
    case 'duplicateValues':
      return { range, duplicates: true, style }
    case 'uniqueValues':
      return { range, unique: true, style }
    case 'colorScale': {
      const colors = rule.colors.map((c) => c ?? '#ffffff')
      if (colors.length === 2) return { range, scale: [colors[0]!, colors[1]!] }
      if (colors.length === 3) return { range, scale: [colors[0]!, colors[1]!, colors[2]!] }
      return null
    }
    case 'dataBar':
      return { range, bar: rule.colors[0] ?? true }
  }
  // others with a formula, such as cells with errors, keep it
  return formulas[0] ? { range, formula: formulaOf(formulas[0]), style } : null
}

/** A data validation as the sheet's, `null` for one it has none like. */
function validationOf(rule: {
  attrs: Record<string, string>
  formula1?: string
  formula2?: string
}): SheetValidation | null {
  const { attrs, formula1, formula2 } = rule
  const range = rangesOf(attrs.sqref)
  if (!range || formula1 == null) return null
  const common = {
    range,
    ...(attrs.errorStyle === 'warning' || attrs.errorStyle === 'information'
      ? { strict: false }
      : {}),
    ...(attrs.error ? { message: attrs.error } : {}),
    ...(attrs.prompt ? { prompt: attrs.prompt } : {}),
  }
  switch (attrs.type) {
    case 'list': {
      const inline = /^"(.*)"$/s.exec(formula1.trim())
      if (!inline) return { ...common, list: formulaOf(formula1) }
      const list = inline[1]!.split(',').map(typedValue)
      return { ...common, list }
    }
    case 'custom':
      return { ...common, formula: formulaOf(formula1) }
    case 'whole':
    case 'decimal':
    case 'date':
    case 'time': {
      const op = CELL_IS[attrs.operator ?? 'between']
      const date = attrs.type === 'date' || attrs.type === 'time'
      const valueOf = (formula: string | undefined) => {
        const value = literalOf(formula)
        if (typeof value !== 'number') return undefined
        return date ? (attrs.type === 'time' ? timeText(value) : dateText(value)) : value
      }
      const value = valueOf(formula1)
      const to = valueOf(formula2)
      if (!op || value === undefined) return null
      if (op === 'between' || op === 'notBetween') {
        if (to === undefined) return null
        return {
          ...common,
          when: { op, value, to },
          ...(attrs.type === 'whole' ? { integer: true } : {}),
        }
      }
      return {
        ...common,
        when: { op, value },
        ...(attrs.type === 'whole' ? { integer: true } : {}),
      }
    }
  }
  return null
}

/** Adds a sheet's notes to its cells. */
function addNotes(data: SheetData, comments: XmlNode) {
  const authors = childrenOf(childOf(comments, 'authors'), 'author').map((a) => a.text)
  for (const comment of childrenOf(childOf(comments, 'commentList'), 'comment')) {
    const point = parseCell(comment.attrs.ref ?? '')
    const body = childOf(comment, 'text')
    if (!point || !body) continue
    let note = unescapeX(textOf(body))
    // other programs put the author's name first, on a line of its own
    const author = authors[+(comment.attrs.authorId ?? -1)]
    if (author && note.startsWith(`${author}:`))
      note = note.slice(author.length + 1).replace(/^\r?\n/, '')
    if (!note) continue
    const line = (data.cells[point.row] ??= [])
    const input = line[point.col]
    line[point.col] =
      input != null && typeof input === 'object'
        ? { ...input, note }
        : { ...(input == null ? {} : { value: input }), note }
  }
}
