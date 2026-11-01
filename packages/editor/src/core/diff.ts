import type { Block, InlineContent } from './model'

/*
 * What changed between two versions of a document, block by block: blocks
 * are matched by id, so a block that was edited is "updated" wherever it
 * moved, and one whose id is only in one version was added or removed.
 * Comments don't count as changes: they come and go apart from the text.
 */

/** One block that differs between two versions. */
export type BlockVersionChange =
  | { type: 'added'; id: string; after: Block }
  /** `next`: the block of the newer version it stood before; `null` at the end. */
  | { type: 'removed'; id: string; before: Block; next: string | null }
  /** Its text, type, attributes or rows changed. */
  | { type: 'updated'; id: string; before: Block; after: Block }

export interface BlocksDiff {
  /** The changed blocks, in the order of the newer version, removed ones where they were. */
  changes: BlockVersionChange[]
  /** The ids of the blocks added, removed and updated, as the `transaction` event's `changes` has them. */
  added: string[]
  removed: string[]
  updated: string[]
}

/** Every block of a tree, parents before their children. */
function flatten(blocks: readonly Block[], out: Block[] = []) {
  for (const block of blocks) {
    out.push(block)
    flatten(block.children, out)
  }
  return out
}

const withoutComments = (content: readonly InlineContent[]) =>
  content.map((item) => {
    if (item.type !== 'text' || !item.comments) return item
    const { comments: _, ...rest } = item
    return rest
  })

/** What a block shows, without its children and comments. */
const own = (block: Block) =>
  JSON.stringify([
    block.type,
    block.props,
    withoutComments(block.content),
    block.rows?.map((row) =>
      row.cells.map((cell) => [withoutComments(cell.content), cell.colspan, cell.rowspan]),
    ),
  ])

/** The blocks added, removed and changed from `before` to `after`. */
export function diffBlocks(before: readonly Block[], after: readonly Block[]): BlocksDiff {
  const old = flatten(before)
  const now = flatten(after)
  const oldById = new Map(old.map((block) => [block.id, block]))
  const nowIds = new Set(now.map((block) => block.id))
  const changes: BlockVersionChange[] = []
  const added: string[] = []
  const removed: string[] = []
  const updated: string[] = []
  // removed blocks go before the first block that followed them and is still there
  const removedBefore = new Map<string | null, Block[]>()
  let pending: Block[] = []
  for (const block of old) {
    if (nowIds.has(block.id)) {
      if (pending.length) removedBefore.set(block.id, pending)
      pending = []
    } else pending.push(block)
  }
  if (pending.length) removedBefore.set(null, pending)
  const putRemoved = (next: string | null) => {
    for (const block of removedBefore.get(next) ?? []) {
      changes.push({ type: 'removed', id: block.id, before: block, next })
      removed.push(block.id)
    }
  }
  for (const block of now) {
    putRemoved(block.id)
    const was = oldById.get(block.id)
    if (!was) {
      changes.push({ type: 'added', id: block.id, after: block })
      added.push(block.id)
    } else if (own(was) !== own(block)) {
      changes.push({ type: 'updated', id: block.id, before: was, after: block })
      updated.push(block.id)
    }
  }
  putRemoved(null)
  return { changes, added, removed, updated }
}

/**
 * A block's inline content as text, one character for each position it
 * takes in the editor: a line break and an inline node (a mention) are
 * one each.
 */
export function inlineText(content: readonly InlineContent[]): string {
  let text = ''
  for (const item of content)
    text += item.type === 'text' ? item.text : item.type === 'break' ? '\n' : '￼'
  return text
}

/** A piece of a text diff: kept, only in the newer text, or only in the older one. */
export interface TextPart {
  type: 'same' | 'added' | 'removed'
  text: string
}

/** Above this many cells the texts are compared as one replaced middle, not character by character. */
const MAX_CELLS = 4_000_000

/**
 * The characters `after` added to `before` and those it removed: their
 * longest common subsequence kept, the rest added or removed. Shared
 * starts and ends are taken off first, so a small edit in a long text is
 * cheap.
 */
export function diffText(before: string, after: string): TextPart[] {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  let end = 0
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++
  const a = before.slice(start, before.length - end)
  const b = after.slice(start, after.length - end)
  const parts: TextPart[] = []
  const push = (type: TextPart['type'], text: string) => {
    if (!text) return
    const last = parts[parts.length - 1]
    if (last?.type === type) last.text += text
    else parts.push({ type, text })
  }
  push('same', before.slice(0, start))
  if (!a.length || !b.length || a.length * b.length > MAX_CELLS) {
    push('removed', a)
    push('added', b)
  } else {
    // lengths of the longest common subsequences of the suffixes
    const width = b.length + 1
    const table = new Uint32Array((a.length + 1) * width)
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        table[i * width + j] =
          a[i] === b[j]
            ? table[(i + 1) * width + j + 1]! + 1
            : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!)
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        push('same', a[i]!)
        i++
        j++
      } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) push('removed', a[i++]!)
      else push('added', b[j++]!)
    }
    push('removed', a.slice(i))
    push('added', b.slice(j))
  }
  push('same', before.slice(before.length - end))
  return parts
}
