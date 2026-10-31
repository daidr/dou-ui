import { formatValue, parseInput } from './format'
import { cellOf, valueOf, type SheetCellInput, type SheetStyle } from './model'

/*
 * Copying cells out as text and as a table, and reading them back from
 * either, so a block of cells moves between this grid, other spreadsheet
 * programs and web pages.
 *
 * Plain text is tab-separated, one row per line, with what each cell shows.
 * The table carries the same text with simple formatting for programs that
 * read tables, and the cells themselves (values, formats and styles) for
 * pasting into a sheet again without losing anything.
 */

/** A block of cells on the clipboard. */
export interface SheetClip {
  /** The cells, row by row. */
  cells: SheetCellInput[][]
  /** The named styles the cells use. */
  styles?: Record<string, SheetStyle>
  /** Where the block was copied from, so formulas can move along when pasted. */
  from?: { row: number; col: number }
  /** Set when the block was cut: pasting it moves the cells. */
  cut?: string
}

const MARK = 'data-dou-sheet'

/** A cell's text in tab-separated text: quoted when it has a tab, a line break or a quote. */
function tsvField(text: string) {
  return /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const escapeHTML = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function cssOf(style: SheetStyle | undefined, align: string | undefined) {
  if (!style && !align) return ''
  let css = ''
  if (style?.bold) css += 'font-weight:bold;'
  if (style?.italic) css += 'font-style:italic;'
  const lines = [style?.underline && 'underline', style?.strike && 'line-through'].filter(Boolean)
  if (lines.length) css += `text-decoration:${lines.join(' ')};`
  if (style?.color) css += `color:${style.color};`
  if (style?.background) css += `background-color:${style.background};`
  if (style?.wrap) css += 'white-space:pre-wrap;'
  const textAlign = style?.align ?? align
  if (textAlign) css += `text-align:${textAlign};`
  return css
}

/**
 * The clipboard's text and HTML for a block of cells. `locale` names the
 * language dates are shown in.
 */
export function writeClip(clip: SheetClip, locale?: string) {
  const styles = clip.styles ?? {}
  const text: string[] = []
  let rows = ''
  for (const line of clip.cells) {
    const fields: string[] = []
    let cols = ''
    for (const input of line) {
      const cell = cellOf(input)
      const value = valueOf(input)
      const shown = formatValue(value, cell?.format, locale)
      fields.push(tsvField(shown))
      const style = cell?.style ? styles[cell.style] : undefined
      const css = cssOf(style, typeof value === 'number' ? 'right' : undefined)
      cols += `<td${css ? ` style="${css}"` : ''}>${escapeHTML(shown).replaceAll('\n', '<br>')}</td>`
    }
    text.push(fields.join('\t'))
    rows += `<tr>${cols}</tr>`
  }
  const data = escapeHTML(JSON.stringify(clip))
  return {
    text: text.join('\n'),
    html: `<table ${MARK}="${data}" style="border-collapse:collapse"><tbody>${rows}</tbody></table>`,
  }
}

/** Splits tab-separated text into rows of fields, reading quoted fields. */
export function parseTSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  // a field is quoted only when the quote starts it
  const atStart = () => field === ''
  for (; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"' && atStart()) quoted = true
    else if (char === '\t') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** The text a table cell shows, with its line breaks. */
function cellText(cell: Element) {
  let text = ''
  const walk = (node: Node) => {
    if (node.nodeType === 3) text += node.textContent?.replace(/\s+/g, ' ') ?? ''
    else if (node.nodeName === 'BR') text += '\n'
    else {
      const block = /^(P|DIV|LI)$/.test(node.nodeName) && text !== '' && !text.endsWith('\n')
      if (block) text += '\n'
      node.childNodes.forEach(walk)
    }
  }
  walk(cell)
  return text.replace(/ *\n */g, '\n').trim()
}

/** Reads a typed-looking text into a cell, keeping the format it implies. */
function inputOf(text: string): SheetCellInput {
  const { value, format } = parseInput(text)
  if (value == null) return undefined
  return format ? { value, format } : value
}

/** Reads a table from HTML: rows and cells, with merged cells spread over the cells they cover. */
function readTable(table: Element): SheetCellInput[][] {
  const out: SheetCellInput[][] = []
  // cells taken by a row span from above
  const taken: boolean[][] = []
  let r = 0
  for (const tr of table.querySelectorAll('tr')) {
    if (tr.closest('table') !== table) continue
    const line = (out[r] ??= [])
    let c = 0
    for (const td of tr.children) {
      if (td.nodeName !== 'TD' && td.nodeName !== 'TH') continue
      while (taken[r]?.[c]) c++
      line[c] = inputOf(cellText(td))
      const rowSpan = Math.max(1, Number(td.getAttribute('rowspan')) || 1)
      const colSpan = Math.max(1, Number(td.getAttribute('colspan')) || 1)
      for (let dr = 0; dr < rowSpan; dr++)
        for (let dc = 0; dc < colSpan; dc++) {
          if (dr === 0 && dc === 0) continue
          ;(taken[r + dr] ??= [])[c + dc] = true
          if (dr === 0) line[c + dc] = undefined
        }
      c += colSpan
    }
    r++
  }
  return out.map((line) => Array.from(line, (cell) => cell))
}

/**
 * Reads what was pasted. Cells copied from a sheet come back as they were;
 * a table from elsewhere, or tab-separated text, comes back as values read
 * the way typing them would, with formats such as `0%` they imply.
 * `null` when there is nothing to paste.
 */
export function readClip(data: { html?: string; text?: string }): SheetClip | null {
  if (data.html && typeof DOMParser !== 'undefined') {
    const page = new DOMParser().parseFromString(data.html, 'text/html')
    const marked = page.querySelector(`table[${MARK}]`)
    if (marked) {
      try {
        const clip = JSON.parse(marked.getAttribute(MARK)!) as SheetClip
        if (Array.isArray(clip.cells)) return clip
      } catch {
        // not ours after all: read it as a table
      }
    }
    const table = page.querySelector('table')
    if (table) {
      const cells = readTable(table)
      if (cells.length) return { cells }
    }
  }
  if (data.text == null || data.text === '') return null
  // a single line copied from a page may end with a line break
  const text = data.text.replace(/\r?\n$/, '')
  return { cells: parseTSV(text).map((line) => line.map(inputOf)) }
}
