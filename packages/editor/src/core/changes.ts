import type { Node as PMNode } from 'prosemirror-model'

/** Which blocks a change touched, by id. */
export interface BlockChanges {
  /** New blocks, including those pasted or split off. */
  added: string[]
  /** Blocks that are gone. */
  removed: string[]
  /** Blocks whose type, props, text or rows changed (not their children). */
  updated: string[]
  /** Blocks that got another parent or another place among their siblings. */
  moved: string[]
}

interface Placed {
  content: PMNode
  parent: string | null
}

interface DocIndex {
  blocks: Map<string, Placed>
  /** Child ids in order, by parent id (`''` for the top level). */
  children: Map<string, string[]>
}

const indexes = new WeakMap<PMNode, DocIndex>()

function indexOf(doc: PMNode): DocIndex {
  const cached = indexes.get(doc)
  if (cached) return cached
  const blocks = new Map<string, Placed>()
  const children = new Map<string, string[]>()
  const visit = (container: PMNode, parent: string | null) => {
    const ids: string[] = []
    container.forEach((block) => {
      const id = block.attrs.id as string
      ids.push(id)
      blocks.set(id, { content: block.firstChild!, parent })
      if (block.childCount > 1) visit(block.child(1), id)
    })
    children.set(parent ?? '', ids)
  }
  visit(doc, null)
  const index = { blocks, children }
  indexes.set(doc, index)
  return index
}

/** The positions that are not part of a longest increasing run: the fewest that moved. */
function outOfOrder(order: number[]): Set<number> {
  // patience sorting, keeping back links to rebuild the run
  const tails: number[] = []
  const previous = Array.from<number>({ length: order.length })
  for (let i = 0; i < order.length; i++) {
    let low = 0
    let high = tails.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (order[tails[mid]!]! < order[i]!) low = mid + 1
      else high = mid
    }
    previous[i] = low > 0 ? tails[low - 1]! : -1
    tails[low] = i
  }
  const kept = new Set<number>()
  for (let i = tails.at(-1) ?? -1; i >= 0; i = previous[i]!) kept.add(i)
  const moved = new Set<number>()
  for (let i = 0; i < order.length; i++) if (!kept.has(i)) moved.add(i)
  return moved
}

/** What changed between two documents, block by block. */
export function diffBlocks(before: PMNode, after: PMNode): BlockChanges {
  const changes: BlockChanges = { added: [], removed: [], updated: [], moved: [] }
  if (before === after) return changes
  const old = indexOf(before)
  const next = indexOf(after)
  for (const [id, placed] of next.blocks) {
    const was = old.blocks.get(id)
    if (!was) {
      changes.added.push(id)
      continue
    }
    if (was.content !== placed.content && !was.content.eq(placed.content)) changes.updated.push(id)
    if (was.parent !== placed.parent) changes.moved.push(id)
  }
  for (const id of old.blocks.keys()) if (!next.blocks.has(id)) changes.removed.push(id)
  // among siblings that stayed with the same parent, the fewest that changed place
  for (const [parent, ids] of next.children) {
    const oldIds = old.children.get(parent)
    if (!oldIds) continue
    if (oldIds === ids) continue
    const rank = new Map(oldIds.map((id, i) => [id, i]))
    const stayed = ids.filter((id) => rank.has(id))
    const order = stayed.map((id) => rank.get(id)!)
    // usually nothing changed place: skip the search
    if (order.every((value, i) => i === 0 || order[i - 1]! < value)) continue
    for (const i of outOfOrder(order)) changes.moved.push(stayed[i]!)
  }
  return changes
}
