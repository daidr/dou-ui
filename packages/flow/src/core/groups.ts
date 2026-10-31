import type { FlowNode, Point, Rect } from './model'

/**
 * Parent links between nodes, worked out once per document. A `parent`
 * naming a missing node, or one that would close a loop, is ignored.
 */
export class FlowTree {
  readonly parents = new Map<string, string>()
  readonly children = new Map<string, string[]>()

  constructor(nodes: readonly FlowNode[]) {
    const ids = new Set(nodes.map((n) => n.id))
    for (const node of nodes)
      if (node.parent && node.parent !== node.id && ids.has(node.parent))
        this.parents.set(node.id, node.parent)
    // Break loops: walk up from each node and drop the link that comes back.
    for (const id of this.parents.keys()) {
      const seen = new Set([id])
      let at = this.parents.get(id)
      while (at) {
        if (seen.has(at)) {
          this.parents.delete(id)
          break
        }
        seen.add(at)
        at = this.parents.get(at)
      }
    }
    for (const [child, parent] of this.parents) {
      const list = this.children.get(parent)
      if (list) list.push(child)
      else this.children.set(parent, [child])
    }
  }

  parentOf(id: string) {
    return this.parents.get(id)
  }

  /** The node's ancestors, nearest first. */
  ancestors(id: string) {
    const out: string[] = []
    for (let at = this.parents.get(id); at; at = this.parents.get(at)) out.push(at)
    return out
  }

  /** All nodes inside, at any depth. */
  descendants(id: string) {
    const out: string[] = []
    const visit = (at: string) => {
      for (const child of this.children.get(at) ?? []) {
        out.push(child)
        visit(child)
      }
    }
    visit(id)
    return out
  }

  depth(id: string) {
    return this.ancestors(id).length
  }

  /** `ids` without the ones inside another of them. */
  topmost(ids: Iterable<string>) {
    const set = new Set(ids)
    return [...set].filter((id) => !this.ancestors(id).some((a) => set.has(a)))
  }
}

const contains = (rect: Rect, p: Point) =>
  p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height

/** The innermost of `containers` whose rect holds `point`. */
export function containerAt(point: Point, containers: { id: string; rect: Rect }[]) {
  let best: { id: string; area: number } | null = null
  for (const { id, rect } of containers) {
    if (!contains(rect, point)) continue
    const area = rect.width * rect.height
    if (!best || area < best.area) best = { id, area }
  }
  return best?.id
}
