import type { ContextMenuItem } from 'dou-ui'
import { ChevronDownIcon, ChevronsDownIcon, ChevronsUpIcon, ChevronUpIcon } from '@dou-ui/icons'
import type { FlowEditorContext } from './context'
import { defineFlowExtension } from './core/extension'
import { intersects } from './core/geometry'

import type { FlowNode } from './core/model'

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

/**
 * Moves the selected nodes in the stack, as one undo step, and says so to
 * screen readers. Returns `false` when nothing moved, e.g. when they already
 * are at the top; that is said too, unless `announce` is `false`.
 */
export function moveLayer(
  ctx: FlowEditorContext,
  move: LayerMove,
  options: { announce?: boolean } = {},
): boolean {
  const t = ctx.messages.value.layers
  const changes = layerChanges(ctx, move)
  const say = (text: string) => options.announce !== false && ctx.announce(text)
  if (!changes.size) {
    if (ctx.selection.value.nodes.length)
      say(
        {
          front: t.top,
          back: t.bottom,
          forward: atEnd(ctx, 'forward') ? t.top : t.noneAbove,
          backward: atEnd(ctx, 'backward') ? t.bottom : t.noneBelow,
        }[move],
      )
    return false
  }
  ctx.transact((tr) => {
    for (const [id, z] of changes) tr.updateNode(id, { z })
  })
  say(t[move])
  return true
}

/** Whether the selected nodes already are at the top (or bottom) of the whole stack. */
function atEnd(ctx: FlowEditorContext, way: 'forward' | 'backward') {
  return !layerChanges(ctx, way === 'forward' ? 'front' : 'back').size
}

const LAYER_KEYS: [LayerMove, string, typeof ChevronsUpIcon][] = [
  ['front', 'mod+shift+]', ChevronsUpIcon],
  ['forward', 'mod+]', ChevronUpIcon],
  ['backward', 'mod+[', ChevronDownIcon],
  ['back', 'mod+shift+[', ChevronsDownIcon],
]

/**
 * Stacking order: what is added lands on top, also once nodes have been
 * moved in the stack.
 */
export const stacking = defineFlowExtension({
  name: 'stacking',
  priority: 0,
  transaction(tr) {
    const ids = new Set<string>()
    for (const step of tr.steps)
      if (step.type === 'addNode' && step.node.z === undefined) ids.add(step.node.id)
    if (!ids.size) return
    let top = 0
    for (const node of tr.doc.nodes) if (!ids.has(node.id)) top = Math.max(top, node.z ?? 0)
    if (!top) return
    for (const id of ids) tr.updateNode(id, { z: ++top })
  },
})

/** Moving nodes up and down the stack from the node menu and with Ctrl / ⌘ + [ and ]. */
export const layers = defineFlowExtension({
  name: 'layers',
  priority: 0,
  contextMenu(ctx, target) {
    if (target.kind !== 'node' || ctx.readonly.value) return []
    const t = ctx.messages.value.layers
    return LAYER_KEYS.map(([move, shortcut, icon], i): ContextMenuItem => ({
      key: `layer-${move}`,
      label: t[move],
      icon,
      shortcut,
      divided: i === 0,
      disabled: !layerChanges(ctx, move).size,
      run: () => void moveLayer(ctx, move),
    }))
  },
  keymap(ctx) {
    const keys: Record<string, () => boolean | void> = {}
    // with Shift first: without it, `mod+[` would match either
    const order = [...LAYER_KEYS.filter(([, key]) => key.includes('shift')), ...LAYER_KEYS]
    for (const [move, key] of order)
      if (!keys[key])
        keys[key] = () => {
          if (ctx.readonly.value || !ctx.selection.value.nodes.length) return false
          moveLayer(ctx, move)
        }
    return keys
  },
})
