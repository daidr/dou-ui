import type { SortableProps } from './sortable'
import { withInstall } from '../../utils/install'
import type { ButtonAttributes } from '../../utils/install'
import SortableHandle from './sortable-handle.vue'
import Sortable from './sortable.vue'

export const DouSortable = withInstall(Sortable)
export const DouSortableHandle = withInstall<typeof SortableHandle, ButtonAttributes>(
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

declare module '../config-provider/config-provider' {
  export interface GenericComponentProps {
    DouSortable: SortableProps
  }
}
