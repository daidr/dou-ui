import { defineComponent } from 'vue'
import type { FunctionalComponent, PropType } from 'vue'
import type { TableRowKey } from './table'

/**
 * One body row, drawn by the table through the default slot. The row
 * re-renders only when its own props change, so selecting, expanding or
 * highlighting one row leaves the others alone.
 */
export default defineComponent({
  name: 'DouTableRow',
  props: {
    row: { type: null as unknown as PropType<unknown>, required: true },
    rowKey: { type: [String, Number] as PropType<TableRowKey>, required: true },
    level: { type: Number, required: true },
    index: { type: Number, required: true },
    parent: { type: Boolean, required: true },
    position: { type: Number, required: true },
    selected: { type: Boolean, required: true },
    expanded: { type: Boolean, required: true },
    current: { type: Boolean, required: true },
    loading: { type: Boolean, required: true },
    /** Bumped when the table's slots may have changed, to redraw every row. */
    version: { type: Number, required: true },
  },
  setup(props, { slots }) {
    return () =>
      slots.default?.({
        item: {
          row: props.row,
          key: props.rowKey,
          level: props.level,
          index: props.index,
          parent: props.parent,
        },
        position: props.position,
        selected: props.selected,
        expanded: props.expanded,
        current: props.current,
        loading: props.loading,
      })
  },
})

/** Renders what a function returns, e.g. a slot called from a row. */
export const CellContent: FunctionalComponent<{ render: () => unknown }> = (props) =>
  props.render() as ReturnType<FunctionalComponent>
