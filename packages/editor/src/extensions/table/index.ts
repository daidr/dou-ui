import { TableIcon } from '@dou-ui/icons'
import { columnResizing, tableEditing } from 'prosemirror-tables'
import { defineExtension } from '../../core/extension'
import { goDown, goToCell, stopAtCellEdge } from './commands'
import { prepareTables, tableOutput } from './html'
import { tablePlugin } from './plugin'
import { tableNodes, tableSpec } from './schema'
import TableControls from './table-controls.vue'
import { CELL_MIN_WIDTH, TableBlockView } from './view'

/**
 * Tables: rows and columns of formatted text. Cells can be merged; rows
 * and columns are added, moved and removed from the handles on their
 * edges, and columns resized by dragging their borders.
 */
export const table = defineExtension({
  name: 'table',
  blocks: { table: tableSpec },
  nodes: tableNodes,
  nodeViews: { table: (node) => new TableBlockView(node) },
  keymap: () => ({
    Tab: goToCell(1),
    'Shift-Tab': goToCell(-1),
    Enter: goDown,
    Backspace: stopAtCellEdge('start'),
    Delete: stopAtCellEdge('end'),
  }),
  plugins: () => [
    columnResizing({ cellMinWidth: 48, defaultCellMinWidth: CELL_MIN_WIDTH, View: null }),
    tableEditing(),
    tablePlugin(),
  ],
  output: { blocks: { table: tableOutput } },
  prepareHTML: prepareTables,
  overlays: [TableControls],
  blockOptions: [
    {
      key: 'table',
      type: 'table',
      label: (m) => m.types.table,
      hint: (m) => m.hints.table,
      icon: TableIcon,
      keywords: ['table', 'grid', 'bg', 'biaoge'],
    },
  ],
})

export {
  alignColumns,
  clearCells,
  deleteColumns,
  deleteRows,
  insertColumn,
  insertRow,
  mergeCells,
  moveLines,
  moveLinesTo,
  splitMergedCell,
  toggleHeader,
} from './commands'
export type { TableAlign, TableColumn } from './schema'
