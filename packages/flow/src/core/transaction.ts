import type { FlowDocument, FlowEdge, FlowNode } from './model'

/*
 * Every change to a document is a list of steps. Applying a step also
 * gives the step that undoes it, so history, collaboration and the
 * `transaction` event all work on the same small vocabulary.
 */

type Patch<T> = { [K in keyof T]?: T[K] | undefined }

export type FlowStep =
  | { type: 'addNode'; node: FlowNode; index?: number }
  | { type: 'removeNode'; id: string }
  | { type: 'updateNode'; id: string; patch: Patch<FlowNode> }
  | { type: 'addEdge'; edge: FlowEdge; index?: number }
  | { type: 'removeEdge'; id: string }
  | { type: 'updateEdge'; id: string; patch: Patch<FlowEdge> }

export interface FlowTransactionMeta {
  /** Keep out of the undo history, e.g. changes from another client. */
  history?: boolean
  /**
   * Consecutive transactions in the same group within a second undo as
   * one, e.g. the frames of a drag or repeated arrow key nudges.
   */
  group?: string
  /** Who made the change, passed on to the `transaction` event. */
  origin?: string
}

function patched<T extends object>(item: T, patch: Patch<T>): T {
  const next = { ...item } as Record<string, unknown>
  for (const key of Object.keys(patch)) {
    const value = (patch as Record<string, unknown>)[key]
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return next as T
}

/** The values `patch` would replace, so applying them restores `item`. */
function previous<T extends object>(item: T, patch: Patch<T>): Patch<T> {
  const old: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) old[key] = (item as Record<string, unknown>)[key]
  return old as Patch<T>
}

const sameValue = (a: unknown, b: unknown) => a === b

/**
 * A batch of changes to a document. Steps apply as they are added, so
 * later calls see earlier ones; `doc` is the result.
 */
export class FlowTransaction {
  readonly steps: FlowStep[] = []
  /** The steps that undo this transaction, in the order to apply them. */
  readonly inverse: FlowStep[] = []
  meta: FlowTransactionMeta = {}
  private nodes: FlowNode[]
  private edges: FlowEdge[]
  private copied = { nodes: false, edges: false }

  constructor(readonly before: FlowDocument) {
    this.nodes = before.nodes
    this.edges = before.edges
  }

  get doc(): FlowDocument {
    if (!this.steps.length) return this.before
    return { ...this.before, nodes: this.nodes, edges: this.edges }
  }

  /** Whether the change makes any change: it has steps and wasn't cancelled. */
  get changed() {
    return this.steps.length > 0 && !this.stopped
  }

  private stopped: { reason?: string } | null = null

  /**
   * Stops the change: none of it is applied or kept for undo, and the
   * editor fires `transactionCancel` and says why. For an extension's `transaction`
   * hook, e.g. to keep people from changing what they may not; hooks after
   * it don't run. A change kept out of the history (`meta.history: false`),
   * such as undo, redo or another person's, can't be cancelled and goes ahead.
   */
  cancel(reason?: string) {
    if (this.meta.history !== false) this.stopped = { reason }
    else warnUncancellable()
    return this
  }

  /** Whether `cancel` stopped it. */
  get cancelled() {
    return this.stopped !== null
  }

  /** What `cancel` was given, to tell people why. */
  get cancelReason() {
    return this.stopped?.reason
  }

  getNode(id: string) {
    return this.nodes.find((node) => node.id === id)
  }

  getEdge(id: string) {
    return this.edges.find((edge) => edge.id === id)
  }

  /** Edges that start or end at a node. */
  edgesOf(id: string) {
    return this.edges.filter((edge) => edge.source.node === id || edge.target.node === id)
  }

  setMeta(meta: FlowTransactionMeta) {
    Object.assign(this.meta, meta)
    return this
  }

  step(step: FlowStep) {
    const inverse = this.apply(step)
    if (inverse) {
      this.steps.push(step)
      this.inverse.unshift(inverse)
    }
    return this
  }

  addNode(node: FlowNode, index?: number) {
    return this.step({ type: 'addNode', node, index })
  }

  /** Removes a node and every edge attached to it. */
  removeNode(id: string) {
    for (const edge of this.edgesOf(id)) this.removeEdge(edge.id)
    return this.step({ type: 'removeNode', id })
  }

  /** Changes a node; resizing it drops the points its edges run through, as its ports move. */
  updateNode(id: string, patch: Patch<FlowNode>) {
    const node = this.getNode(id)
    if (
      node &&
      (('width' in patch && patch.width !== node.width) ||
        ('height' in patch && patch.height !== node.height))
    )
      for (const edge of this.edgesOf(id))
        if (edge.points) this.updateEdge(edge.id, { points: undefined })
    return this.step({ type: 'updateNode', id, patch })
  }

  /**
   * Moves a node. An edge at it whose other end has moved just as far in
   * this transaction keeps the points it runs through, moved along; any
   * other edge at it drops them, as they no longer fit.
   */
  moveNode(id: string, x: number, y: number) {
    const node = this.getNode(id)
    if (!node) return this.updateNode(id, { x, y })
    if (node.x === x && node.y === y) return this
    this.updateNode(id, { x, y })
    const shift = this.shiftOf(id)!
    for (const edge of this.edgesOf(id)) {
      const before = this.before.edges.find((e) => e.id === edge.id)
      if (!before?.points) {
        if (edge.points) this.updateEdge(edge.id, { points: undefined })
        continue
      }
      const other = this.shiftOf(edge.source.node === id ? edge.target.node : edge.source.node)
      const together = other && other.x === shift.x && other.y === shift.y
      if (!together) {
        if (edge.points) this.updateEdge(edge.id, { points: undefined })
        continue
      }
      this.updateEdge(edge.id, {
        points: before.points.map((p) => ({ x: p.x + shift.x, y: p.y + shift.y })),
      })
    }
    return this
  }

  /** How far a node has moved in this transaction so far. */
  private shiftOf(id: string) {
    const now = this.getNode(id)
    const was = this.before.nodes.find((n) => n.id === id)
    return now && was ? { x: now.x - was.x, y: now.y - was.y } : undefined
  }

  /** Merges `patch` into the node's `data`. */
  updateData(id: string, patch: Record<string, unknown>) {
    const node = this.getNode(id)
    if (!node) return this
    return this.updateNode(id, { data: { ...node.data, ...patch } })
  }

  addEdge(edge: FlowEdge, index?: number) {
    return this.step({ type: 'addEdge', edge, index })
  }

  removeEdge(id: string) {
    return this.step({ type: 'removeEdge', id })
  }

  updateEdge(id: string, patch: Patch<FlowEdge>) {
    return this.step({ type: 'updateEdge', id, patch })
  }

  private writable(kind: 'nodes' | 'edges') {
    if (!this.copied[kind]) {
      this.copied[kind] = true
      if (kind === 'nodes') this.nodes = this.nodes.slice()
      else this.edges = this.edges.slice()
    }
    return kind === 'nodes' ? this.nodes : this.edges
  }

  /** Applies a step and returns its inverse, or `null` when it changes nothing. */
  private apply(step: FlowStep): FlowStep | null {
    switch (step.type) {
      case 'addNode': {
        if (this.getNode(step.node.id)) return null
        const list = this.writable('nodes') as FlowNode[]
        const index = clampIndex(step.index, list.length)
        list.splice(index, 0, step.node)
        return { type: 'removeNode', id: step.node.id }
      }
      case 'removeNode': {
        const index = this.nodes.findIndex((node) => node.id === step.id)
        if (index < 0) return null
        const list = this.writable('nodes') as FlowNode[]
        const [node] = list.splice(index, 1)
        return { type: 'addNode', node: node!, index }
      }
      case 'updateNode': {
        const index = this.nodes.findIndex((node) => node.id === step.id)
        if (index < 0) return null
        const node = this.nodes[index]!
        const keys = Object.keys(step.patch) as (keyof FlowNode)[]
        if (keys.every((key) => sameValue(node[key], step.patch[key]))) return null
        const list = this.writable('nodes') as FlowNode[]
        list[index] = patched(node, step.patch)
        return { type: 'updateNode', id: step.id, patch: previous(node, step.patch) }
      }
      case 'addEdge': {
        if (this.getEdge(step.edge.id)) return null
        const list = this.writable('edges') as FlowEdge[]
        list.splice(clampIndex(step.index, list.length), 0, step.edge)
        return { type: 'removeEdge', id: step.edge.id }
      }
      case 'removeEdge': {
        const index = this.edges.findIndex((edge) => edge.id === step.id)
        if (index < 0) return null
        const list = this.writable('edges') as FlowEdge[]
        const [edge] = list.splice(index, 1)
        return { type: 'addEdge', edge: edge!, index }
      }
      case 'updateEdge': {
        const index = this.edges.findIndex((edge) => edge.id === step.id)
        if (index < 0) return null
        const edge = this.edges[index]!
        const keys = Object.keys(step.patch) as (keyof FlowEdge)[]
        if (keys.every((key) => sameValue(edge[key], step.patch[key]))) return null
        const list = this.writable('edges') as FlowEdge[]
        list[index] = patched(edge, step.patch)
        return { type: 'updateEdge', id: step.id, patch: previous(edge, step.patch) }
      }
    }
  }
}

function clampIndex(index: number | undefined, length: number) {
  if (index == null) return length
  return Math.max(0, Math.min(length, index))
}

/** Applies steps to a document; steps that no longer apply are skipped. */
export function applyFlowSteps(doc: FlowDocument, steps: readonly FlowStep[]) {
  const tr = new FlowTransaction(doc)
  for (const step of steps) tr.step(step)
  return tr
}

const targetOf = (step: FlowStep) => {
  switch (step.type) {
    case 'addNode':
      return `n:${step.node.id}`
    case 'addEdge':
      return `e:${step.edge.id}`
    case 'removeNode':
    case 'updateNode':
      return `n:${step.id}`
    case 'removeEdge':
    case 'updateEdge':
      return `e:${step.id}`
  }
}

/**
 * Folds updates of the same node or edge into one, as long as nothing
 * adds or removes it in between. Updates of different targets commute, so
 * the result applies the same as the original list.
 */
export function compactFlowSteps(steps: readonly FlowStep[]): FlowStep[] {
  const out: (FlowStep | null)[] = []
  const lastUpdate = new Map<string, number>()
  for (const step of steps) {
    const target = targetOf(step)
    if (step.type === 'updateNode' || step.type === 'updateEdge') {
      const at = lastUpdate.get(target)
      if (at != null) {
        const prev = out[at] as typeof step
        out[at] = { ...prev, patch: { ...prev.patch, ...step.patch } } as FlowStep
        continue
      }
      lastUpdate.set(target, out.length)
    } else {
      lastUpdate.delete(target)
    }
    out.push(step)
  }
  return out.filter((step): step is FlowStep => step != null)
}

let warnedUncancellable = false
/** Says once that cancelling a change kept out of the history does nothing. */
function warnUncancellable() {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production' || warnedUncancellable) return
  warnedUncancellable = true
  console.warn(
    "[@dou-ui/flow] a change kept out of the history (undo, redo or another person's) can't be cancelled; it goes ahead",
  )
}
