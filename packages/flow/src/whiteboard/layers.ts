import type { FlowEditorContext } from '../context'
import { intersects } from '../core/geometry'
import type { FlowNode } from '../core/model'

export type LayerMove = 'front' | 'forward' | 'backward' | 'back'

/** The nodes that stack, bottom first: what the editor draws in that order. */
function stack(ctx: FlowEditorContext): FlowNode[] {
  const nodes = ctx.doc.value.nodes.filter((node) => !ctx.isContainer(node))
  const index = new Map(nodes.map((node, i) => [node.id, i]))
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  return nodes.sort((a, b) => (a.z ?? 0) - (b.z ?? 0) || index.get(a.id)! - index.get(b.id)!)
}

/**
 * The selected nodes moved in the stack: to the top or bottom of everything,
 * or one step past the nearest node each overlaps, so the step can be seen.
 * Returns the `z` of every node whose place changed, numbering the stack
 * from 0 at the bottom; nothing when nothing would change.
 */
export function layerChanges(ctx: FlowEditorContext, move: LayerMove): Map<string, number> {
  const selected = new Set(ctx.selection.value.nodes)
  const order = stack(ctx)
  const moving = order.filter((node) => selected.has(node.id))
  const others = order.filter((node) => !selected.has(node.id))
  let next: FlowNode[]
  if (move === 'front') next = [...others, ...moving]
  else if (move === 'back') next = [...moving, ...others]
  else {
    const up = move === 'forward'
    next = [...order]
    const rect = (node: FlowNode) => ctx.getNodeRect(node.id)
    // from the end it moves towards, so the moved nodes don't pass each other
    for (let k = 0; k < moving.length; k++) {
      const node = moving[up ? moving.length - 1 - k : k]!
      const at = next.indexOf(node)
      const box = rect(node)
      // the nearest unselected node it overlaps, walking the way it moves
      let past: FlowNode | undefined
      for (let i = up ? at + 1 : at - 1; i >= 0 && i < next.length; i += up ? 1 : -1) {
        const other = next[i]!
        const r = rect(other)
        if (!selected.has(other.id) && box && r && intersects(box, r)) {
          past = other
          break
        }
      }
      if (!past) continue
      next.splice(at, 1)
      next.splice(next.indexOf(past) + (up ? 1 : 0), 0, node)
    }
  }
  const out = new Map<string, number>()
  if (next.every((node, i) => node === order[i])) return out
  next.forEach((node, i) => {
    if ((node.z ?? 0) !== i) out.set(node.id, i)
  })
  return out
}

/** Moves the selected nodes in the stack, as one undo step; `false` when nothing moved. */
export function moveLayer(ctx: FlowEditorContext, move: LayerMove): boolean {
  const changes = layerChanges(ctx, move)
  if (!changes.size) return false
  ctx.transact((tr) => {
    for (const [id, z] of changes) tr.updateNode(id, { z })
  })
  return true
}
