/**
 * The document text: an immutable, balanced tree of lines.
 *
 * Leaves hold up to `LEAF_MAX` lines, branches up to `BRANCH_MAX` children,
 * and every node knows its length and line count, so finding a line by
 * number or by offset walks one path from the root: O(log n). An edit copies
 * only that path and shares everything else with the old text, so keeping
 * old versions around (undo, a `v-model:doc` snapshot) costs next to
 * nothing.
 *
 * Offsets count UTF-16 code units, like the browser and language servers.
 * Lines are numbered from 1 and are joined by one `\n`; a `\r\n` or a lone
 * `\r` in the input becomes `\n`.
 */

import { markRaw } from 'vue'

const LEAF_MAX = 64
const LEAF_MIN = 16
const BRANCH_MAX = 32
const BRANCH_MIN = 8
/** New leaves and branches start half full, so the next edits rarely split them. */
const LEAF_FILL = LEAF_MAX >> 1
const BRANCH_FILL = BRANCH_MAX >> 1

/** One line of the text. */
export interface CodeLine {
  /** The line number, from 1. */
  readonly number: number
  /** Offset of the line's first character. */
  readonly from: number
  /** Offset just after the line's last character, before its line break. */
  readonly to: number
  /** The line's text, without the line break. */
  readonly text: string
}

type Node = Leaf | Branch

class Leaf {
  readonly length: number
  /** The longest line, in code units. */
  readonly widest: number
  constructor(readonly text: readonly string[]) {
    let length = text.length - 1
    let widest = 0
    for (const line of text) {
      length += line.length
      if (line.length > widest) widest = line.length
    }
    this.length = length
    this.widest = widest
  }
  get lines() {
    return this.text.length
  }
}

class Branch {
  readonly length: number
  readonly lines: number
  readonly widest: number
  constructor(readonly children: readonly Node[]) {
    let length = children.length - 1
    let lines = 0
    let widest = 0
    for (const child of children) {
      length += child.length
      lines += child.lines
      if (child.widest > widest) widest = child.widest
    }
    this.length = length
    this.lines = lines
    this.widest = widest
  }
}

const isSmall = (node: Node) =>
  node instanceof Leaf ? node.text.length < LEAF_MIN : node.children.length < BRANCH_MIN

/** Cuts a list into nodes of about `fill` items each; never one smaller than half of it. */
function chunk<T, N>(items: readonly T[], fill: number, max: number, make: (part: T[]) => N): N[] {
  if (items.length <= max) return [make(items as T[])]
  const count = Math.ceil(items.length / fill)
  const size = Math.ceil(items.length / count)
  const out: N[] = []
  for (let i = 0; i < items.length; i += size) out.push(make(items.slice(i, i + size)))
  return out
}

const leaves = (lines: readonly string[]) =>
  chunk(lines, LEAF_FILL, LEAF_MAX, (part) => new Leaf(part))

const branches = (nodes: readonly Node[]) =>
  chunk(nodes, BRANCH_FILL, BRANCH_MAX, (part) => new Branch(part))

/** Stacks nodes of one height into a single root. */
function root(nodes: Node[]): Node {
  while (nodes.length > 1) nodes = branches(nodes)
  let node = nodes[0] ?? new Leaf([''])
  while (node instanceof Branch && node.children.length === 1) node = node.children[0]!
  return node
}

/** Joins two neighbours of the same height and cuts the result again if it grew too big. */
function merge(a: Node, b: Node): Node[] {
  if (a instanceof Leaf && b instanceof Leaf) return leaves([...a.text, ...b.text])
  return branches([...(a as Branch).children, ...(b as Branch).children])
}

/** Merges every small node into a neighbour, so the tree stays shallow after deletes. */
function settle(nodes: Node[]): Node[] {
  if (nodes.length < 2 || !nodes.some(isSmall)) return nodes
  const out: Node[] = []
  for (const node of nodes) {
    const last = out[out.length - 1]
    if (last && (isSmall(last) || isSmall(node))) out.splice(-1, 1, ...merge(last, node))
    else out.push(node)
  }
  return out
}

/**
 * Replaces `count` lines from line index `at` (from 0) with `insert`, and
 * returns the nodes that take this one's place, all of its height.
 */
function splice(node: Node, at: number, count: number, insert: readonly string[]): Node[] {
  if (node instanceof Leaf) {
    const text = node.text.slice(0, at).concat(insert, node.text.slice(at + count))
    return text.length ? leaves(text) : []
  }
  const children: Node[] = []
  let start = 0
  let pending: readonly string[] | null = insert
  const last = node.children.length - 1
  node.children.forEach((child, i) => {
    const end = start + child.lines
    // Lines go into the child that holds `at`, or the last one when `at` is the end.
    const holds = at < end || (i === last && at === end)
    const overlaps = count > 0 && at < end && at + count > start
    if ((pending && holds && at >= start) || overlaps) {
      const from = Math.max(at - start, 0)
      const to = Math.min(at + count - start, child.lines)
      children.push(...splice(child, from, Math.max(to - from, 0), pending ?? []))
      pending = null
    } else {
      children.push(child)
    }
    start = end
  })
  const settled = settle(children)
  if (!settled.length) return []
  return branches(settled)
}

/**
 * Each node's text, kept once asked for. Nodes never change and an edit
 * makes new ones only along one path, so joining the whole text again
 * after an edit only joins that path: the engine strings together the
 * kept parts without copying them.
 */
const joined = new WeakMap<Node, string>()
function joinNode(node: Node): string {
  let text = joined.get(node)
  if (text !== undefined) return text
  if (node instanceof Leaf) text = node.text.join('\n')
  else {
    text = joinNode(node.children[0]!)
    for (let i = 1; i < node.children.length; i++) text += '\n' + joinNode(node.children[i]!)
  }
  joined.set(node, text)
  return text
}

/** Collects the text of lines `from`–`to` (indices from 0, `to` exclusive). */
function collect(node: Node, from: number, to: number, out: string[]) {
  if (node instanceof Leaf) {
    for (let i = from; i < to; i++) out.push(node.text[i]!)
    return
  }
  let start = 0
  for (const child of node.children) {
    const end = start + child.lines
    if (end > from && start < to)
      collect(child, Math.max(from - start, 0), Math.min(to - start, child.lines), out)
    if (end >= to) return
    start = end
  }
}

/** Splits text into lines, reading `\r\n` and a lone `\r` as line breaks too. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n?|\n/)
}

/** Where a text keeps its tree; a symbol rather than a private field, so a `ref` around a text keeps its type. */
const NODE = Symbol('node')

export class CodeText {
  /** @internal */
  readonly [NODE]: Node

  private constructor(node: Node) {
    this[NODE] = node
    // Immutable: a ref around it needs no deep proxy, and comparing by identity keeps working.
    markRaw(this)
  }

  /** The text of a string. */
  static of(text: string | readonly string[]): CodeText {
    const lines = typeof text === 'string' ? splitLines(text) : text.length ? text : ['']
    const parts = leaves(lines)
    // Each leaf's text is a slice of the source, which costs nothing to keep and saves joining it later.
    if (typeof text === 'string' && !text.includes('\r')) {
      let at = 0
      for (const leaf of parts) {
        joined.set(leaf, text.slice(at, at + leaf.length))
        at += leaf.length + 1
      }
    }
    return new CodeText(root(parts))
  }

  /** An empty text: one empty line. */
  static readonly empty: CodeText = CodeText.of('')

  /** Length in UTF-16 code units, counting one per line break. */
  get length(): number {
    return this[NODE].length
  }

  /** The number of lines, at least 1. */
  get lines(): number {
    return this[NODE].lines
  }

  /** The length of the longest line, in code units. */
  get widest(): number {
    return this[NODE].widest
  }

  /** Line `n`, counting from 1. */
  line(n: number): CodeLine {
    if (n < 1 || n > this.lines) throw new RangeError(`Line ${n} is outside 1–${this.lines}`)
    let node = this[NODE]
    let index = n - 1
    let from = 0
    while (node instanceof Branch) {
      for (const child of node.children) {
        if (index < child.lines) {
          node = child
          break
        }
        index -= child.lines
        from += child.length + 1
      }
    }
    for (let i = 0; i < index; i++) from += node.text[i]!.length + 1
    const text = node.text[index]!
    return { number: n, from, to: from + text.length, text }
  }

  /** The line that holds offset `pos`; a line break belongs to the line before it. */
  lineAt(pos: number): CodeLine {
    if (pos < 0 || pos > this.length)
      throw new RangeError(`Offset ${pos} is outside 0–${this.length}`)
    let node = this[NODE]
    let from = 0
    let number = 1
    while (node instanceof Branch) {
      for (const child of node.children) {
        const end = from + child.length
        if (pos <= end) {
          node = child
          break
        }
        from = end + 1
        number += child.lines
      }
    }
    for (const text of node.text) {
      const end = from + text.length
      if (pos <= end) return { number, from, to: end, text }
      from = end + 1
      number++
    }
    // unreachable: `pos` is inside the leaf
    throw new RangeError(`Offset ${pos} not found`)
  }

  /** The text of lines `from`–`to`, both counted from 1 and included. */
  lineTexts(from: number, to: number = from): string[] {
    const out: string[] = []
    from = Math.max(from, 1)
    to = Math.min(to, this.lines)
    if (from <= to) collect(this[NODE], from - 1, to, out)
    return out
  }

  /** The text between two offsets. */
  slice(from = 0, to = this.length): string {
    from = Math.max(0, from)
    to = Math.min(this.length, to)
    if (from >= to) return ''
    const start = this.lineAt(from)
    if (to <= start.to) return start.text.slice(from - start.from, to - start.from)
    const end = this.lineAt(to)
    const lines = this.lineTexts(start.number, end.number)
    lines[0] = lines[0]!.slice(from - start.from)
    lines[lines.length - 1] = lines[lines.length - 1]!.slice(0, to - end.from)
    return lines.join('\n')
  }

  /** A new text with `from`–`to` replaced by `insert`; this one stays as it is. */
  replace(from: number, to: number, insert: string | readonly string[]): CodeText {
    if (from < 0 || to > this.length || from > to)
      throw new RangeError(`Range ${from}–${to} is outside 0–${this.length}`)
    const lines = typeof insert === 'string' ? splitLines(insert) : insert
    if (from === to && lines.length === 1 && !lines[0]) return this
    const start = this.lineAt(from)
    const end = to <= start.to ? start : this.lineAt(to)
    const head = start.text.slice(0, from - start.from)
    const tail = end.text.slice(to - end.from)
    const next = lines.slice()
    next[0] = head + next[0]
    next[next.length - 1] += tail
    const nodes = splice(this[NODE], start.number - 1, end.number - start.number + 1, next)
    return new CodeText(root(nodes))
  }

  /** Every line, from 1 to the end. */
  toLines(): string[] {
    return this.lineTexts(1, this.lines)
  }

  /** The whole text, with `\n` between lines. */
  toString(): string {
    return joinNode(this[NODE])
  }

  /** Whether two texts hold the same characters. */
  eq(other: CodeText): boolean {
    if (other === this) return true
    if (other.length !== this.length || other.lines !== this.lines) return false
    const a = this.toLines()
    const b = other.toLines()
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
}
