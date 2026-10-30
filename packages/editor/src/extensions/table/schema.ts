import type { Node as PMNode, NodeSpec, NodeType } from 'prosemirror-model'
import { TableMap } from 'prosemirror-tables'
import {
  createId,
  inlineNodes,
  inlineOf,
  type BlockProps,
  type PartialTableCell,
  type PartialTableRow,
  type RowsSpec,
  type TableCell,
  type TableRow,
} from '../../core/model'

/** A column of a table: a stable id, and how its cells align. */
export interface TableColumn {
  id: string
  /** In pixels; without it the column takes its share of the width. */
  width?: number
  align?: TableAlign
}

export type TableAlign = 'left' | 'center' | 'right'

const ALIGNS = new Set(['left', 'center', 'right'])

/** The columns as stored on the table node: id and alignment (widths live on the cells). */
interface StoredColumn {
  id: string
  align?: TableAlign
}

export const isAlign = (value: unknown): value is TableAlign => ALIGNS.has(value as string)

/** One column record per column of the grid, keeping ids and alignment that are there. */
export function fitColumns(columns: unknown, width: number): StoredColumn[] {
  const list = Array.isArray(columns) ? (columns as Partial<TableColumn>[]) : []
  const seen = new Set<string>()
  const result: StoredColumn[] = []
  for (let index = 0; index < width; index++) {
    const column = list[index] ?? {}
    let id = typeof column.id === 'string' && column.id ? column.id : createId()
    if (seen.has(id)) id = createId()
    seen.add(id)
    result.push(isAlign(column.align) ? { id, align: column.align } : { id })
  }
  return result
}

export const isHeaderAt = (attrs: Record<string, unknown>, row: number, col: number) =>
  (!!attrs.headerRow && row === 0) || (!!attrs.headerColumn && col === 0)

/* table node ↔ rows */

function readRows(node: PMNode): { props: BlockProps; rows: TableRow[] } {
  const map = TableMap.get(node)
  const columns = fitColumns(node.attrs.columns, map.width)
  const widths: (number | undefined)[] = []
  const rows: TableRow[] = []
  for (let row = 0; row < map.height; row++) {
    const cells: TableCell[] = []
    for (let col = 0; col < map.width; col++) {
      const pos = map.map[row * map.width + col]!
      const rect = map.findCell(pos)
      const cell = node.nodeAt(pos)!
      const width = (cell.attrs.colwidth as number[] | null)?.[col - rect.left]
      if (width && widths[col] === undefined) widths[col] = width
      if (rect.left !== col || rect.top !== row) {
        // covered by a merged cell
        cells.push({ content: [] })
        continue
      }
      const item: TableCell = { content: inlineOf(cell) }
      if (rect.right - rect.left > 1) item.colspan = rect.right - rect.left
      if (rect.bottom - rect.top > 1) item.rowspan = rect.bottom - rect.top
      cells.push(item)
    }
    rows.push({ id: (node.child(row).attrs.id as string | null) ?? '', cells })
  }
  return {
    props: {
      headerRow: !!node.attrs.headerRow,
      headerColumn: !!node.attrs.headerColumn,
      columns: columns.map((column, index) =>
        widths[index] ? { ...column, width: widths[index] } : column,
      ),
    },
    rows,
  }
}

const DEFAULT_SIZE = 3

function writeRows(type: NodeType, props: BlockProps, given: PartialTableRow[]): PMNode {
  const schema = type.schema
  const rows: PartialTableRow[] = given.length
    ? given
    : Array.from({ length: DEFAULT_SIZE }, () => ({
        cells: Array.from({ length: DEFAULT_SIZE }, () => ''),
      }))
  const listed = Array.isArray(props.columns) ? (props.columns as Partial<TableColumn>[]) : []
  const width = Math.max(1, listed.length, ...rows.map((row) => row.cells.length))
  const height = rows.length
  const columns = fitColumns(listed, width)
  const widths = Array.from({ length: width }, (_, index) => {
    const value = Number(listed[index]?.width)
    return value > 0 ? Math.round(value) : 0
  })
  const attrs = {
    headerRow: props.headerRow === undefined ? true : !!props.headerRow,
    headerColumn: !!props.headerColumn,
    columns,
  }
  const covered = Array.from({ length: height }, () => Array.from({ length: width }, () => false))
  const free = (top: number, left: number, bottom: number, right: number) => {
    for (let row = top; row < bottom; row++)
      for (let col = left; col < right; col++) if (covered[row]![col]) return false
    return true
  }
  const rowNodes = rows.map((row, r) => {
    const cells: PMNode[] = []
    for (let c = 0; c < width; c++) {
      if (covered[r]![c]) continue
      const raw = row.cells[c]
      const cell: PartialTableCell = typeof raw === 'string' ? { content: raw } : (raw ?? {})
      // spans stay inside the table and never overlap another merged cell
      let colspan = Math.max(1, Math.min(Math.floor(cell.colspan ?? 1) || 1, width - c))
      let rowspan = Math.max(1, Math.min(Math.floor(cell.rowspan ?? 1) || 1, height - r))
      while (colspan > 1 && !free(r, c, r + 1, c + colspan)) colspan--
      while (rowspan > 1 && !free(r, c, r + rowspan, c + colspan)) rowspan--
      for (let y = r; y < r + rowspan; y++)
        for (let x = c; x < c + colspan; x++) covered[y]![x] = true
      const span = widths.slice(c, c + colspan)
      const cellType = isHeaderAt(attrs, r, c) ? schema.nodes.tableHeader! : schema.nodes.tableCell!
      cells.push(
        cellType.create(
          { colspan, rowspan, colwidth: span.some(Boolean) ? span : null },
          inlineNodes(schema, cell.content, false),
        ),
      )
    }
    return schema.nodes.tableRow!.create({ id: row.id || createId() }, cells)
  })
  return type.create(attrs, rowNodes)
}

export const tableRows: RowsSpec = { read: readRows, write: writeRows }

/* DOM */

function cellAttrs(dom: HTMLElement) {
  const widthAttr = dom.getAttribute('data-colwidth')
  const colspan = Number(dom.getAttribute('colspan') || 1)
  const widths =
    widthAttr && /^\d+(,\d+)*$/.test(widthAttr) ? widthAttr.split(',').map(Number) : null
  return {
    colspan,
    rowspan: Number(dom.getAttribute('rowspan') || 1),
    colwidth: widths && widths.length === colspan ? widths : null,
  }
}

function cellDOM(tag: 'td' | 'th') {
  return (node: PMNode) => {
    const attrs: Record<string, string> = {}
    if (node.attrs.colspan !== 1) attrs.colspan = String(node.attrs.colspan)
    if (node.attrs.rowspan !== 1) attrs.rowspan = String(node.attrs.rowspan)
    if (node.attrs.colwidth) attrs['data-colwidth'] = (node.attrs.colwidth as number[]).join(',')
    return [tag, attrs, 0] as const
  }
}

const cellSpec = (role: 'cell' | 'header_cell', tag: 'td' | 'th'): NodeSpec => ({
  content: 'inline*',
  tableRole: role,
  isolating: true,
  attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
  parseDOM: [{ tag, getAttrs: (dom) => cellAttrs(dom as HTMLElement) }],
  toDOM: cellDOM(tag),
})

/** The table's alignment per column, from the first row of a pasted table. */
function columnsFromDOM(table: HTMLElement): StoredColumn[] {
  const first = table.querySelector('tr')
  const columns: StoredColumn[] = []
  for (const cell of Array.from(first?.children ?? [])) {
    const align = (cell as HTMLElement).style.textAlign || cell.getAttribute('align')
    const span = Number(cell.getAttribute('colspan') || 1)
    for (let index = 0; index < span; index++)
      columns.push(isAlign(align) ? { id: createId(), align } : { id: createId() })
  }
  return columns
}

export const tableSpec: NodeSpec = {
  content: 'tableRow+',
  tableRole: 'table',
  isolating: true,
  attrs: {
    headerRow: { default: true },
    headerColumn: { default: false },
    columns: { default: [] },
  },
  rows: tableRows,
  parseDOM: [
    {
      tag: 'table',
      getAttrs: (dom) => {
        const table = dom as HTMLElement
        const rows = Array.from(table.querySelectorAll('tr'))
        const firstCells = Array.from(rows[0]?.children ?? [])
        return {
          headerRow: firstCells.length > 0 && firstCells.every((cell) => cell.tagName === 'TH'),
          headerColumn:
            rows.length > 1 && rows.every((row) => row.firstElementChild?.tagName === 'TH'),
          columns: columnsFromDOM(table),
        }
      },
    },
  ],
  toDOM: () => [
    'div',
    { class: 'dou-editor__content dou-editor__content--table', 'data-content-type': 'table' },
    ['table', ['tbody', 0]],
  ],
}

export const tableNodes: Record<string, NodeSpec> = {
  // rows a merged cell covers completely have no cells of their own
  tableRow: {
    content: '(tableCell | tableHeader)*',
    tableRole: 'row',
    attrs: { id: { default: null } },
    parseDOM: [
      { tag: 'tr', getAttrs: (dom) => ({ id: (dom as HTMLElement).dataset.rowId ?? null }) },
    ],
    toDOM: (node) => ['tr', { 'data-row-id': node.attrs.id }, 0],
  },
  tableCell: cellSpec('cell', 'td'),
  tableHeader: cellSpec('header_cell', 'th'),
}
