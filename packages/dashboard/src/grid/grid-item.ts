import {
  defineComponent,
  h,
  inject,
  type InjectionKey,
  type PropType,
  type Slots,
  type VNodeArrayChildren,
} from 'vue'
import type { GridItem } from '../layout/types'
import type { GridResizeHandle } from './types'

export interface GridItemContext {
  slots: Slots
  /** The id the description of every item is read from. */
  hintId: string
  resizeLabel: () => string
}

export const gridItemKey: InjectionKey<GridItemContext> = Symbol('dou-grid-item')

/**
 * One item of the grid. A component of its own so that moving one item
 * re-renders that item alone: the others get the same `item` object back
 * from the layout engine, and their slot content isn't run again.
 */
export default defineComponent({
  name: 'DouGridLayoutItem',
  props: {
    item: { type: Object as PropType<GridItem>, required: true },
    state: { type: String as PropType<'idle' | 'dragging' | 'resizing'>, default: 'idle' },
    editable: Boolean,
    /** -1, 0, or undefined when the item itself isn't focusable. */
    tabindex: { type: Number, default: undefined },
    label: { type: String, required: true },
    roleDescription: { type: String, required: true },
    handles: { type: Array as PropType<GridResizeHandle[]>, default: () => [] },
  },
  setup(props) {
    const context = inject(gridItemKey)!
    return () => {
      const { item, state, editable } = props
      const movable = editable && !item.locked
      const children: VNodeArrayChildren = [
        context.slots.item?.({
          item,
          dragging: state === 'dragging',
          resizing: state === 'resizing',
        }),
      ]
      if (movable)
        for (const edge of props.handles)
          children.push(
            h('span', {
              class: `dou-grid-layout__resize is-${edge}`,
              'data-grid-resize': edge,
              'aria-hidden': 'true',
              title: edge === 'se' ? context.resizeLabel() : undefined,
            }),
          )
      return h(
        'div',
        {
          class: [
            'dou-grid-layout__item',
            {
              'is-movable': movable,
              'is-locked': item.locked,
              'is-dragging': state === 'dragging',
              'is-resizing': state === 'resizing',
            },
          ],
          style: {
            '--dou-grid-x': item.x,
            '--dou-grid-y': item.y,
            '--dou-grid-w': item.w,
            '--dou-grid-h': item.h,
          },
          'data-grid-id': item.id,
          tabindex: props.tabindex,
          role: editable ? 'group' : undefined,
          'aria-roledescription': editable ? props.roleDescription : undefined,
          'aria-label': editable ? props.label : undefined,
          'aria-describedby': movable ? context.hintId : undefined,
        },
        children,
      )
    }
  },
})
