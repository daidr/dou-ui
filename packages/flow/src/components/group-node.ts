import { defineNodeType } from '../core/node-types'
import GroupNode from './group-node.vue'

export interface GroupNodeData {
  [key: string]: unknown
  /** The title. */
  label?: string
  /** Folded to its title; the nodes inside are hidden and their edges end on it. */
  collapsed?: boolean
}

/**
 * A titled frame that holds other nodes: nodes dropped inside move with it,
 * and it folds down to its title. Not in the palette; add
 * `{ ...groupNode, palette: { label } }` to offer it there.
 */
export const groupNode = defineNodeType<GroupNodeData>({
  type: 'group',
  component: GroupNode,
  container: true,
  resizable: { minWidth: 160, minHeight: 96 },
  size: { width: 320, height: 200 },
  defaults: () => ({ label: '' }),
})
