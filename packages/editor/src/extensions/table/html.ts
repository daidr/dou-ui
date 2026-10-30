import type { Block, TableCell } from '../../core/model'
import type { BlockOutput } from '../../core/output'
import { isAlign, isHeaderAt, type TableColumn } from './schema'

interface Placed {
  cell: TableCell
  row: number
  col: number
}

/** The cells that show, row by row: covered ones are left out, spans kept inside the table. */
function placedRows(block: Block): { rows: Placed[][]; width: number } {
  const rows = block.rows ?? []
  const width = Math.max(0, ...rows.map((row) => row.cells.length))
  const covered = rows.map(() => Array.from({ length: width }, () => false))
  const result = rows.map((row, r) => {
    const placed: Placed[] = []
    for (let c = 0; c < width; c++) {
      if (covered[r]![c]) continue
      const cell = row.cells[c] ?? { content: [] }
      let colspan = Math.max(1, Math.min(cell.colspan ?? 1, width - c))
      let rowspan = Math.max(1, Math.min(cell.rowspan ?? 1, rows.length - r))
      while (colspan > 1 && covered[r]!.slice(c, c + colspan).some(Boolean)) colspan--
      while (
        rowspan > 1 &&
        covered.slice(r, r + rowspan).some((line) => line.slice(c, c + colspan).some(Boolean))
      )
        rowspan--
      for (let y = r; y < r + rowspan; y++)
        for (let x = c; x < c + colspan; x++) covered[y]![x] = true
      placed.push({ cell: { ...cell, colspan, rowspan }, row: r, col: c })
    }
    return placed
  })
  return { rows: result, width }
}

const columnsOf = (block: Block) =>
  (Array.isArray(block.props.columns) ? block.props.columns : []) as Partial<TableColumn>[]

function tableHTML(block: Block, inline: (cell: TableCell) => string): string {
  const { rows } = placedRows(block)
  const columns = columnsOf(block)
  const widths = columns.map((column) => Number(column.width) || 0)
  const colgroup = widths.some(Boolean)
    ? `<colgroup>${widths.map((width) => (width ? `<col style="width: ${width}px">` : '<col>')).join('')}</colgroup>`
    : ''
  const props = { headerRow: block.props.headerRow ?? true, headerColumn: block.props.headerColumn }
  const rowHTML = (placed: Placed[]) =>
    `<tr>${placed
      .map(({ cell, row, col }) => {
        const tag = isHeaderAt(props, row, col) ? 'th' : 'td'
        const align = columns[col]?.align
        const attrs = [
          cell.colspan! > 1 ? ` colspan="${cell.colspan}"` : '',
          cell.rowspan! > 1 ? ` rowspan="${cell.rowspan}"` : '',
          isAlign(align) && align !== 'left' ? ` style="text-align: ${align}"` : '',
        ].join('')
        return `<${tag}${attrs}>${inline(cell)}</${tag}>`
      })
      .join('')}</tr>`
  const [head, ...body] = rows
  const thead = props.headerRow && head ? `<thead>${rowHTML(head)}</thead>` : ''
  const tbody = (props.headerRow ? body : rows).map(rowHTML).join('')
  return `<table>${colgroup}${thead}${tbody ? `<tbody>${tbody}</tbody>` : ''}</table>`
}

/** GitHub's table syntax. Its first row is always the header; merged cells leave the covered places empty. */
function tableMarkdown(block: Block, inline: (cell: TableCell) => string): string {
  const { rows, width } = placedRows(block)
  if (!rows.length || !width) return ''
  const columns = columnsOf(block)
  const lines = rows.map((placed) => {
    const cells = Array.from({ length: width }, () => '')
    for (const { cell, col } of placed) cells[col] = inline(cell)
    return `| ${cells.join(' | ')} |`
  })
  const rule = Array.from({ length: width }, (_, index) => {
    const align = columns[index]?.align
    return align === 'center' ? ':-:' : align === 'right' ? '--:' : '---'
  })
  return [lines[0], `| ${rule.join(' | ')} |`, ...lines.slice(1)].join('\n')
}

export const tableOutput: BlockOutput = {
  html: (block, { inline, children }) =>
    tableHTML(block, (cell) => inline(cell.content)) + children,
  markdown: (block, { inline, children }) => {
    // a cell is one line: line breaks become `<br>`
    const table = tableMarkdown(block, (cell) =>
      inline(cell.content).replace(/\\\n/g, '<br>').replace(/\n/g, ' '),
    )
    return children ? `${table}\n\n${children}` : table
  },
}

/* reading */

const BLOCKS =
  'p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, ul, ol, figure, details, table, thead, tbody, tfoot, tr, td, th'

/** A cell holds a line of text: its paragraphs and list items become lines, images their text. */
function flattenCell(cell: Element) {
  const doc = cell.ownerDocument
  for (const img of Array.from(cell.querySelectorAll('img')))
    img.replaceWith(doc.createTextNode(img.getAttribute('alt') ?? ''))
  // innermost first
  const blocks = Array.from(cell.querySelectorAll(BLOCKS))
  for (let index = blocks.length - 1; index >= 0; index--) {
    const element = blocks[index]!
    const parts: Node[] = Array.from(element.childNodes)
    if (element.nextSibling && element.textContent?.trim()) parts.push(doc.createElement('br'))
    element.replaceWith(...parts)
  }
}

/** Widths from a `<colgroup>`, put on each cell as `data-colwidth`, which the cells read. */
function spreadWidths(table: HTMLTableElement) {
  const cols = Array.from(table.querySelectorAll(':scope > colgroup > col'))
  if (!cols.length) return
  const widths = cols.flatMap((col) => {
    const width = /^(\d+)px$/.exec((col as HTMLElement).style.width)?.[1]
    const span = Number(col.getAttribute('span') || 1)
    return Array.from({ length: span }, () => Number(width) || 0)
  })
  if (!widths.some(Boolean)) return
  const taken: boolean[][] = []
  Array.from(table.rows).forEach((row, r) => {
    taken[r] ??= []
    let c = 0
    for (const cell of Array.from(row.cells)) {
      while (taken[r]![c]) c++
      for (let y = r; y < r + cell.rowSpan; y++) {
        taken[y] ??= []
        for (let x = c; x < c + cell.colSpan; x++) taken[y]![x] = true
      }
      const span = widths.slice(c, c + cell.colSpan)
      if (span.length === cell.colSpan && span.some(Boolean)) cell.dataset.colwidth = span.join(',')
      c += cell.colSpan
    }
  })
}

/** Get pasted and imported tables ready: widths onto the cells, and each cell down to one line of text. */
export function prepareTables(root: HTMLElement) {
  const tables = Array.from(root.querySelectorAll('table')).filter(
    (table) => !table.parentElement?.closest('td, th'),
  )
  for (const table of tables) {
    spreadWidths(table)
    for (const cell of Array.from(table.querySelectorAll('td, th'))) flattenCell(cell)
  }
}
