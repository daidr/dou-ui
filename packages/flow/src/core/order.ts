import type { FlowDocument, FlowNode } from './model'

const before = (a: FlowNode, b: FlowNode) => a.x - b.x || a.y - b.y

/**
 * Nodes in the order a flow reads: every node after the ones it depends on,
 * and among nodes that are ready, the leftmost (then topmost) first. Nodes
 * on a cycle follow the rest, left to right.
 */
export function flowOrder(doc: FlowDocument): FlowNode[] {
  const byId = new Map(doc.nodes.map((node) => [node.id, node]))
  const waiting = new Map(doc.nodes.map((node) => [node.id, 0]))
  const next = new Map<string, string[]>()
  for (const edge of doc.edges) {
    const { node: from } = edge.source
    const { node: to } = edge.target
    if (from === to || !byId.has(from) || !byId.has(to)) continue
    waiting.set(to, waiting.get(to)! + 1)
    const list = next.get(from)
    if (list) list.push(to)
    else next.set(from, [to])
  }
  const ready = doc.nodes.filter((node) => waiting.get(node.id) === 0)
  const out: FlowNode[] = []
  while (ready.length) {
    let pick = 0
    for (let i = 1; i < ready.length; i++) if (before(ready[i]!, ready[pick]!) < 0) pick = i
    const [node] = ready.splice(pick, 1)
    out.push(node!)
    for (const id of next.get(node!.id) ?? []) {
      const left = waiting.get(id)! - 1
      waiting.set(id, left)
      if (left === 0) ready.push(byId.get(id)!)
    }
  }
  if (out.length < doc.nodes.length) {
    const placed = new Set(out)
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh list
    out.push(...doc.nodes.filter((node) => !placed.has(node)).sort(before))
  }
  return out
}
