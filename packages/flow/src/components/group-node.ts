import { defineNodeType } from '../core/node-types'
import { drawCard } from '../export/draw'
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
  draw(node, draw) {
    const title = draw.style('dou-flow-group-node__title')
    // a picture has nothing to fold: no toggle, the title where it starts
    return (
      drawCard(draw, ['is-container'].concat(node.data?.collapsed ? ['is-collapsed'] : [])) +
      draw.text(
        node.data?.label || draw.messages.group,
        { x: 12, y: 0, width: Math.max(0, draw.width - 24), height: 40 },
        {
          size: Number.parseFloat(title.fontSize) || 13,
          weight: title.fontWeight,
          color: draw.color(title.color),
          valign: 'middle',
          nowrap: true,
          lineHeight: 40,
        },
      )
    )
  },
})
