import type { ButtonHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import SortableHandle from './sortable-handle.vue'
import Sortable from './sortable.vue'

export const DouSortable = withInstall(Sortable)
export const DouSortableHandle = withInstall<typeof SortableHandle, ButtonHTMLAttributes>(
  SortableHandle,
)
export default DouSortable

export { useSortable } from './use-sortable'
export type { SortableMessages, UseSortableOptions } from './use-sortable'
export type * from './sortable'

declare module 'vue' {
  export interface GlobalComponents {
    DouSortable: typeof DouSortable
    DouSortableHandle: typeof DouSortableHandle
  }
}
