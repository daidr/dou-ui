import type { MarkdownBlock, MarkdownInline, MarkdownItem, MarkdownRow } from './markdown'
import { parseBlocks, splitRow, type BNode, type SourceLine } from './parse-block'
import { parseInline, type MarkdownRefs } from './parse-inline'

type Converted = MarkdownBlock | MarkdownItem | MarkdownRow
type Ref = MarkdownRefs extends Map<string, infer V> ? V : never

/** Reference definitions, noting the labels looked up and not found. */
class RefLookup extends Map<string, Ref> {
  misses: string[] = []
  override get(label: string) {
    const ref = super.get(label)
    if (!ref) this.misses.push(label)
    return ref
  }
}

// labels a leaf or row looked up without finding a definition
const missesOf = new WeakMap<object, string[]>()

/** Whether a label that `node` looked for without finding is defined now. */
const resolvable = (node: object, refs: RefLookup) =>
  missesOf.get(node)?.some((label) => Map.prototype.has.call(refs, label)) ?? false

/** Labels the blocks used without a definition, so a later one can fix them. */
function collectMisses(node: Converted, into: Set<string>) {
  for (const label of missesOf.get(node) ?? []) into.add(label)
  if (node.type === 'table') {
    collectMisses(node.head, into)
    for (const row of node.rows) collectMisses(row, into)
  } else if ('children' in node && node.type !== 'paragraph' && node.type !== 'heading')
    for (const child of node.children) collectMisses(child as Converted, into)
}

interface Context {
  refs: RefLookup
  /** The leaf still being written. */
  tip: BNode | null
  /** What the previous update made, by kind and start, to hand back unchanged. */
  prev: Map<string, Converted>
  next: Map<string, Converted>
}

// whether a leaf was read as the unfinished end of a stream
const partialOf = new WeakMap<object, boolean>()

function inlineOf(lines: SourceLine[], refs: MarkdownRefs, partial: boolean): MarkdownInline[] {
  if (lines.length === 1) {
    const line = lines[0]!
    return parseInline(line.text.replace(/[ \t]+$/, ''), (i) => line.at + i, refs, partial)
  }
  let text = ''
  const starts: number[] = []
  for (const line of lines) {
    if (starts.length) text += '\n'
    starts.push(text.length)
    text += line.text
  }
  const at = (index: number) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid]! <= index) lo = mid
      else hi = mid - 1
    }
    return lines[lo]!.at + index - starts[lo]!
  }
  return parseInline(text.replace(/[ \t]+$/, ''), at, refs, partial)
}

function remember<T extends Converted>(ctx: Context, key: string, value: T): T {
  ctx.next.set(key, value)
  return value
}

const sameChildren = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((child, index) => child === b[index])

function convertLeaf(n: BNode, ctx: Context, lines: SourceLine[] = n.lines): MarkdownBlock | null {
  const key = `${n.kind}:${n.start}`
  const partial = n === ctx.tip
  if (n.kind === 'paragraph' && partial) {
    // a lone `| a | b |` is a table header until its delimiter row says otherwise
    const last = lines[lines.length - 1]
    const before = lines[lines.length - 2]
    if (
      last &&
      before?.text.trimStart().startsWith('|') &&
      /^[|:\- \t]*$/.test(last.text) &&
      /[|:]/.test(last.text)
    )
      // `|` or `|:` under a header: a delimiter row just begun
      lines = lines.slice(0, -2)
    else if (last && last.text.trimStart().startsWith('|')) lines = lines.slice(0, -1)
  }
  if (n.kind === 'paragraph' && !lines.length) return null
  const last = lines[lines.length - 1]
  const end = n.kind === 'heading' || !last ? n.end : last.at + last.text.length
  const prev = ctx.prev.get(key)
  if (prev && prev.end === end && partialOf.get(prev) === partial && !resolvable(prev, ctx.refs)) {
    if (prev.type === 'paragraph' || (prev.type === 'heading' && prev.level === n.level))
      return remember(ctx, key, prev)
  }
  const misses = ctx.refs.misses.length
  const children = inlineOf(lines, ctx.refs, partial)
  const block: MarkdownBlock =
    n.kind === 'heading'
      ? {
          type: 'heading',
          level: Math.min(6, Math.max(1, n.level)) as 1 | 2 | 3 | 4 | 5 | 6,
          start: n.start,
          end,
          children,
        }
      : { type: 'paragraph', start: n.start, end, children }
  if (ctx.refs.misses.length > misses) missesOf.set(block, ctx.refs.misses.slice(misses))
  partialOf.set(block, partial)
  return remember(ctx, key, block)
}

function isTight(list: BNode): boolean {
  const items = list.children
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const next = items[i + 1]
    if (next && next.startLine > item.endLine + 1) return false
    const kids = item.children
    for (let k = 0; k + 1 < kids.length; k++)
      if (kids[k + 1]!.startLine > kids[k]!.endLine + 1) return false
  }
  return true
}

const TASK = /^\[([ xX])\](?=[ \t]|$)/
const TASK_PENDING = /^\[[ xX]?\]?$/

function convertItem(n: BNode, tight: boolean, ctx: Context): MarkdownItem {
  const key = `item:${n.start}`
  let checked: boolean | null = null
  const children: MarkdownBlock[] = []
  n.children.forEach((child, index) => {
    if (index === 0 && child.kind === 'paragraph' && child.lines.length) {
      const first = child.lines[0]!
      const task = TASK.exec(first.text)
      if (task) {
        checked = task[1] !== ' '
        const rest = first.text.slice(3)
        const lead = rest.length - rest.trimStart().length
        const lines = [
          { text: rest.trimStart(), at: first.at + 3 + lead, line: first.line },
          ...child.lines.slice(1),
        ]
        const block = convertLeaf(child, ctx, lines)
        if (block) children.push(block)
        return
      }
      // `[x` at the end of a stream: a checkbox on its way
      if (child === ctx.tip && child.lines.length === 1 && TASK_PENDING.test(first.text)) return
    }
    const block = convert(child, ctx)
    if (block) children.push(block)
  })
  const prev = ctx.prev.get(key)
  if (
    prev?.type === 'item' &&
    prev.end === n.end &&
    prev.checked === checked &&
    prev.tight === tight &&
    sameChildren(prev.children, children)
  )
    return remember(ctx, key, prev)
  return remember(ctx, key, {
    type: 'item',
    start: n.start,
    end: n.end,
    checked,
    tight,
    children,
  })
}

function convertRow(
  line: SourceLine,
  columns: number,
  partial: boolean,
  ctx: Context,
): MarkdownRow {
  const key = `row:${line.line}`
  const end = line.at + line.text.length
  const prev = ctx.prev.get(key)
  if (
    prev?.type === 'row' &&
    prev.end === end &&
    partialOf.get(prev) === partial &&
    !resolvable(prev, ctx.refs)
  )
    return remember(ctx, key, prev)
  const cells = splitRow(line.text)
  const misses = ctx.refs.misses.length
  const row: MarkdownRow = {
    type: 'row',
    start: line.line,
    end,
    cells: Array.from({ length: columns }, (_, index) => {
      const cell = cells[index]
      if (!cell) return []
      const at = line.at + cell.index
      return parseInline(
        cell.text,
        (i) => at + i,
        ctx.refs,
        partial && index === Math.min(cells.length, columns) - 1,
      )
    }),
  }
  if (ctx.refs.misses.length > misses) missesOf.set(row, ctx.refs.misses.slice(misses))
  partialOf.set(row, partial)
  return remember(ctx, key, row)
}

function convert(n: BNode, ctx: Context): MarkdownBlock | null {
  const key = `${n.kind}:${n.start}`
  const prev = ctx.prev.get(key)
  switch (n.kind) {
    case 'paragraph':
    case 'heading':
      return convertLeaf(n, ctx)
    case 'code': {
      const closed = !n.fence || n.closed
      if (prev?.type === 'code' && prev.end === n.end && prev.closed === closed)
        return remember(ctx, key, prev)
      return remember(ctx, key, {
        type: 'code',
        start: n.start,
        end: n.end,
        lang: n.info.split(/\s/)[0] ?? '',
        value: n.lines.map((line) => line.text).join('\n'),
        closed,
      })
    }
    case 'hr':
      if (prev?.type === 'hr' && prev.end === n.end) return remember(ctx, key, prev)
      return remember(ctx, key, { type: 'hr', start: n.start, end: n.end })
    case 'blockquote': {
      const children = convertAll(n.children, ctx)
      if (
        prev?.type === 'blockquote' &&
        prev.end === n.end &&
        sameChildren(prev.children, children)
      )
        return remember(ctx, key, prev)
      return remember(ctx, key, { type: 'blockquote', start: n.start, end: n.end, children })
    }
    case 'container': {
      const children = convertAll(n.children, ctx)
      const title = n.info.trim()
      if (
        prev?.type === 'container' &&
        prev.end === n.end &&
        prev.closed === n.closed &&
        prev.name === n.marker &&
        prev.title === title &&
        sameChildren(prev.children, children)
      )
        return remember(ctx, key, prev)
      return remember(ctx, key, {
        type: 'container',
        start: n.start,
        end: n.end,
        name: n.marker,
        title,
        closed: n.closed,
        children,
      })
    }
    case 'list': {
      const tight = isTight(n)
      const children = n.children.map((item) => convertItem(item, tight, ctx))
      if (
        prev?.type === 'list' &&
        prev.end === n.end &&
        prev.tight === tight &&
        prev.startNumber === n.startNumber &&
        sameChildren(prev.children, children)
      )
        return remember(ctx, key, prev)
      return remember(ctx, key, {
        type: 'list',
        start: n.start,
        end: n.end,
        ordered: n.ordered,
        startNumber: n.startNumber,
        tight,
        children,
      })
    }
    case 'table': {
      const columns = n.align.length
      const partial = n === ctx.tip
      const [header, ...body] = n.lines
      const head = convertRow(header!, columns, partial && !body.length, ctx)
      const rows = body.map((line, index) =>
        convertRow(line, columns, partial && index === body.length - 1, ctx),
      )
      if (
        prev?.type === 'table' &&
        prev.end === n.end &&
        prev.head === head &&
        prev.align.join() === n.align.join() &&
        sameChildren(prev.rows, rows)
      )
        return remember(ctx, key, prev)
      return remember(ctx, key, {
        type: 'table',
        start: n.start,
        end: n.end,
        align: n.align,
        head,
        rows,
      })
    }
    default:
      return null
  }
}

function convertAll(nodes: BNode[], ctx: Context): MarkdownBlock[] {
  const out: MarkdownBlock[] = []
  for (const n of nodes) {
    const block = convert(n, ctx)
    if (block) out.push(block)
  }
  return out
}

export interface MarkdownParseOptions {
  /** The stream is over: unfinished syntax at the end is read as it stands. */
  final?: boolean
}

export interface MarkdownParser {
  /**
   * Parse `source`, a longer version of the last one while streaming.
   * Blocks that cannot change any more are not parsed again, and every
   * block that is unchanged since the last update is the same object.
   * Pass `{ final: true }` once the stream is over.
   */
  update: (source: string, options?: MarkdownParseOptions) => MarkdownBlock[]
  /** How many leading blocks of the last update can no longer change. */
  readonly stable: number
  /** Forget everything parsed so far. */
  reset: () => void
}

/** An incremental parser for a Markdown stream. */
export function createMarkdownParser(): MarkdownParser {
  let frozen: MarkdownBlock[] = []
  let frozenEnd = 0
  let frozenSource = ''
  let refs: MarkdownRefs = new Map()
  let frozenMisses = new Set<string>()
  let prev = new Map<string, Converted>()

  function reset() {
    frozen = []
    frozenEnd = 0
    frozenSource = ''
    refs = new Map()
    frozenMisses = new Set()
    prev = new Map()
  }

  function update(source: string, { final = false }: MarkdownParseOptions = {}): MarkdownBlock[] {
    if (frozenEnd && !source.startsWith(frozenSource)) reset()
    const result = parseBlocks(source, frozenEnd, !final)
    // A definition that a block already frozen looked for: start over once.
    // Rare (a definition usually comes after its use only at the very end),
    // so a full parse is simpler than finding the blocks it changes.
    if (frozenMisses.size) {
      for (const label of result.refs.keys()) {
        if (!frozenMisses.has(label)) continue
        reset()
        return update(source, { final })
      }
    }
    const lookup = new RefLookup(refs.size ? [...result.refs, ...refs] : result.refs)
    const ctx: Context = { refs: lookup, tip: result.tip, prev, next: new Map() }
    const stable = convertAll(result.blocks.slice(0, result.stable), ctx)
    const tail = convertAll(result.blocks.slice(result.stable), ctx)
    if (result.stable) {
      frozen = frozen.concat(stable)
      for (const block of stable) collectMisses(block, frozenMisses)
      frozenEnd = result.resume
      frozenSource = source.slice(0, frozenEnd)
      for (const label of result.stableLabels) {
        const def = result.refs.get(label)
        if (def && !refs.has(label)) refs.set(label, def)
      }
    }
    prev = ctx.next
    return frozen.concat(tail)
  }

  return {
    update,
    get stable() {
      return frozen.length
    },
    reset,
  }
}

/** Parse a whole Markdown document. Works anywhere, without a DOM. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  return createMarkdownParser().update(source, { final: true })
}
