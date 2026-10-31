import type { PivotGroupBy } from './group'
import { IntIndex, typed, type PivotIndexPacket } from './hash'
import { finder, type PivotDimensionColumn, type PivotResolvedField } from './source'

/** A field on an axis, with what the config asked of it. */
export interface PivotLevel {
  field: PivotResolvedField<unknown>
  column: PivotDimensionColumn
  sort: 'asc' | 'desc'
  subtotal: boolean
  /** How the field's values are grouped, when not by each value. */
  by?: PivotGroupBy
}

/**
 * The groups along one axis. Node 0 is the whole axis (the grand total);
 * a node at depth `d` is a group of the `d`-th field inside its parent.
 * Children are kept in label order, as compressed lists: the children of
 * `node` are `children[childStart[node]]` up to `children[childStart[node + 1]]`.
 */
export class PivotTree {
  /** The root: the grand total, as a row or column group. */
  readonly total = 0
  readonly size: number
  readonly levels: readonly PivotLevel[]
  readonly parent: Int32Array
  readonly depth: Uint8Array
  /** The group number within its field (`-1` for the root). */
  readonly code: Int32Array
  readonly childStart: Int32Array
  readonly children: Int32Array
  /** Where each node starts and ends in a walk of the tree, to tell descendants apart. */
  readonly enter: Int32Array
  readonly exit: Int32Array
  private index: IntIndex
  private stride: number

  constructor(builder: PivotTreeBuilder, levels: readonly PivotLevel[]) {
    const size = builder.size
    this.size = size
    this.levels = levels
    this.parent = builder.parent.slice(0, size)
    this.depth = builder.depth.slice(0, size)
    this.code = builder.code.slice(0, size)
    this.index = builder.index
    this.stride = builder.stride
    // children by parent, in the order they were made, then sorted by label
    const childStart = new Int32Array(size + 1)
    for (let node = 1; node < size; node++) childStart[this.parent[node]! + 1]!++
    for (let node = 0; node < size; node++) childStart[node + 1]! += childStart[node]!
    const fill = childStart.slice(0, size)
    const children = new Int32Array(Math.max(0, size - 1))
    for (let node = 1; node < size; node++) children[fill[this.parent[node]!]!++] = node
    this.childStart = childStart
    this.children = children
    for (let node = 0; node < size; node++) {
      const from = childStart[node]!
      const to = childStart[node + 1]!
      if (to - from < 2) continue
      const level = levels[this.depth[node]!]!
      const { rank } = level.column
      const sign = level.sort === 'desc' ? -1 : 1
      const code = this.code
      children.subarray(from, to).sort((a, b) => {
        const ra = rank[code[a]!]!
        const rb = rank[code[b]!]!
        // the empty group stays last either way
        if (level.column.empty >= 0) {
          if (code[a] === level.column.empty) return 1
          if (code[b] === level.column.empty) return -1
        }
        return sign * (ra - rb)
      })
    }
    this.enter = new Int32Array(size)
    this.exit = new Int32Array(size)
    this.walk()
  }

  /** The tree as data: typed arrays to move to another thread, or to write as JSON. */
  pack(): PivotTreePacket {
    return {
      size: this.size,
      stride: this.stride,
      parent: this.parent,
      depth: this.depth,
      code: this.code,
      childStart: this.childStart,
      children: this.children,
      enter: this.enter,
      exit: this.exit,
      index: this.index.pack(),
      levels: this.levels.map((l) => ({
        field: l.field.name,
        sort: l.sort,
        subtotal: l.subtotal,
        ...(l.by === undefined ? {} : { by: l.by }),
        labels: l.column.labels,
        empty: l.column.empty,
        rank: l.column.rank,
      })),
    }
  }

  /** A tree made from `pack()`'s output, with fields described by `field`. */
  static unpack(
    packet: PivotTreePacket,
    field: (name: string) => PivotResolvedField<unknown>,
  ): PivotTree {
    const tree = Object.create(PivotTree.prototype) as PivotTree
    const levels: PivotLevel[] = packet.levels.map((l) => {
      const f = field(l.field)
      // JSON writes dates as text
      const labels =
        f.type === 'date' && l.by === undefined
          ? l.labels.map((v) => (typeof v === 'string' ? new Date(v) : v))
          : l.labels
      return {
        field: f,
        sort: l.sort,
        subtotal: l.subtotal,
        by: l.by,
        column: {
          codes: new Uint32Array(0),
          labels,
          empty: l.empty,
          rank: typed(Uint32Array, l.rank),
          find: finder(labels, l.empty),
        },
      }
    })
    Object.assign(tree, {
      total: 0,
      size: packet.size,
      levels,
      parent: typed(Int32Array, packet.parent),
      depth: typed(Uint8Array, packet.depth),
      code: typed(Int32Array, packet.code),
      childStart: typed(Int32Array, packet.childStart),
      children: typed(Int32Array, packet.children),
      enter: typed(Int32Array, packet.enter),
      exit: typed(Int32Array, packet.exit),
      index: IntIndex.unpack(packet.index),
      stride: packet.stride,
    })
    return tree
  }

  /** The node's own value (its group label); `undefined` for the root. */
  label(node: number): unknown {
    if (node <= 0) return undefined
    return this.levels[this.depth[node]! - 1]!.column.labels[this.code[node]!]
  }

  /** The labels from the outermost group down to `node`. */
  path(node: number): unknown[] {
    const path: unknown[] = []
    for (let at = node; at > 0; at = this.parent[at]!) path.push(this.label(at))
    // oxlint-disable-next-line unicorn/no-array-reverse -- reverses its own array
    return path.reverse()
  }

  /** The node with these labels, or -1. */
  find(path: readonly unknown[]): number {
    let node = 0
    for (let d = 0; d < path.length; d++) {
      const level = this.levels[d]
      if (!level) return -1
      const code = level.column.find(path[d])
      if (code < 0) return -1
      const id = this.index.get(node * this.stride + code)
      if (id < 0) return -1
      node = id + 1
    }
    return node
  }

  /** Whether `node` has groups inside it. */
  isGroup(node: number) {
    return this.childStart[node + 1]! > this.childStart[node]!
  }

  /** Whether `node` is `ancestor` or inside it. */
  within(node: number, ancestor: number) {
    return this.enter[node]! >= this.enter[ancestor]! && this.enter[node]! < this.exit[ancestor]!
  }

  private walk() {
    const { childStart, children, enter, exit } = this
    const stack = new Int32Array(this.levels.length + 2)
    const next = new Int32Array(this.levels.length + 2)
    let top = 0
    let clock = 0
    stack[0] = 0
    next[0] = childStart[0]!
    enter[0] = clock++
    while (top >= 0) {
      const node = stack[top]!
      if (next[top]! < childStart[node + 1]!) {
        const child = children[next[top]!++]!
        top++
        stack[top] = child
        next[top] = childStart[child]!
        enter[child] = clock++
      } else {
        exit[node] = clock
        top--
      }
    }
  }
}

/** A `PivotTree` as data. */
export interface PivotTreePacket {
  size: number
  stride: number
  parent: ArrayLike<number>
  depth: ArrayLike<number>
  code: ArrayLike<number>
  childStart: ArrayLike<number>
  children: ArrayLike<number>
  enter: ArrayLike<number>
  exit: ArrayLike<number>
  index: PivotIndexPacket
  levels: {
    field: string
    sort: 'asc' | 'desc'
    subtotal: boolean
    by?: PivotGroupBy
    labels: unknown[]
    empty: number
    rank: ArrayLike<number>
  }[]
}

/** Grows a tree one record at a time: each record walks down its groups. */
export class PivotTreeBuilder {
  parent = new Int32Array(64)
  depth = new Uint8Array(64)
  code = new Int32Array(64)
  size = 1
  readonly index: IntIndex

  /** `stride` is more than any group number, so (parent, group) makes a unique key. */
  constructor(readonly stride: number) {
    this.parent[0] = -1
    this.code[0] = -1
    this.index = new IntIndex(256)
  }

  /** The child of `node` for group `code`, made when new. */
  child(node: number, code: number) {
    const index = this.index
    const before = index.size
    const id = index.add(node * this.stride + code)
    const child = id + 1
    if (index.size !== before) {
      if (child >= this.parent.length) this.grow()
      this.parent[child] = node
      this.depth[child] = this.depth[node]! + 1
      this.code[child] = code
      this.size = child + 1
    }
    return child
  }

  private grow() {
    const capacity = this.parent.length * 2
    const parent = new Int32Array(capacity)
    parent.set(this.parent)
    const depth = new Uint8Array(capacity)
    depth.set(this.depth)
    const code = new Int32Array(capacity)
    code.set(this.code)
    this.parent = parent
    this.depth = depth
    this.code = code
  }
}
