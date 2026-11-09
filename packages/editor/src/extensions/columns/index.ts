import { LayoutColumnsIcon } from '@dou-ui/icons'
import { defineEditorExtension } from '../../core/extension'
import ColumnPicker from './column-picker.vue'
import ColumnsControls from './columns-controls.vue'
import { columnsOutput, prepareColumns } from './html'
import { columnKeys } from './keys'
import { columnsPlugin } from './plugin'
import { columnSpec, columnsSpec, MAX_COLUMNS, MIN_COLUMNS } from './schema'
import SelectColumns from './select-columns.vue'

const counts = Array.from(
  { length: MAX_COLUMNS - MIN_COLUMNS + 1 },
  (_, index) => MIN_COLUMNS + index,
)

/**
 * Columns: blocks side by side, two to five of them. In the slash menu,
 * “Columns” opens a picker for how many. Each column holds any blocks,
 * which move between columns like anywhere else; dropping blocks between
 * two columns makes a new one there, and dragging the bar between two
 * columns resizes them. On a narrow screen the columns stack.
 */
export const columns = defineEditorExtension({
  name: 'columns',
  blocks: { columns: columnsSpec, column: columnSpec },
  keymap: columnKeys,
  plugins: ({ messages }) => [
    columnsPlugin((index, count) =>
      messages().columns.column.replace('{index}', String(index)).replace('{count}', String(count)),
    ),
  ],
  output: { blocks: columnsOutput },
  prepareHTML: prepareColumns,
  overlays: [ColumnsControls],
  blockMenu: [SelectColumns],
  blockOptions: [
    {
      key: 'columns',
      type: 'columns',
      props: { count: MIN_COLUMNS },
      label: (m) => m.types.columns,
      hint: (m) => m.hints.columns,
      icon: LayoutColumnsIcon,
      keywords: ['columns', 'layout', 'grid', 'fl', 'fenlan'],
      choices: {
        title: (m) => m.columns.pick,
        items: counts.map((count) => ({
          props: { count },
          label: (m) => m.columns.count.replace('{count}', String(count)),
        })),
        component: ColumnPicker,
      },
    },
  ],
})

export { MAX_COLUMNS } from './schema'
