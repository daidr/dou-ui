import { ChevronDownIcon } from '@dou-ui/icons'
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
    const toggle = draw.style('dou-flow-group-node__toggle')
    const chevron = draw.color(toggle.color)
    // the toggle's chevron, turned to the right when folded
    const turn = node.data?.collapsed ? ' transform="rotate(-90 20 20)"' : ''
    return (
      drawCard(draw, ['is-container'].concat(node.data?.collapsed ? ['is-collapsed'] : [])) +
      `<g${turn}>${draw.icon(ChevronDownIcon, { x: 12, y: 12, width: 16, height: 16 }, chevron)}</g>` +
      draw.text(
        node.data?.label || draw.messages.group,
        { x: 36, y: 0, width: Math.max(0, draw.width - 48), height: 40 },
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
