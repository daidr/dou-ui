import {
  Fragment,
  type Mark,
  type Node as PMNode,
  type ResolvedPos,
  type Schema,
} from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import * as Y from 'yjs'
import { blockAround, findBlockById } from '../core/blocks'
import { createId } from '../core/model'
import { originKey } from '../core/editor'
import { joinStepKey, ownStepKey } from '../core/transaction'
import { placeOf } from './cursors'
import { keptIndexes, keysBetween, orderKeys } from './order'
import { mergedPropsOf, newMerged, readMerged, writeMerged } from './merged-props'
import { cellAt, cellStart, clearTable, readTable, writeTable } from './table'
import { inlineFrom, insertInline, updateText, type Attributes } from './text'

/*
 * How a document is stored in Yjs. Every block is one entry of a `Y.Map`,
 * by id, holding its type, its props, its text and its place: the id of its
 * parent and an order key among its siblings. Moving a block only changes
 * its place, so text typed into it meanwhile by someone else stays in it.
 *
 *   map: Y.Map<id, Y.Map {
 *     type: string
 *     props: Y.Map<name, value>
 *     text: Y.Text      (marks as formatting attributes, inline nodes as embeds)
 *     parent: string | null
 *     order: string
 *   }>
 *
 * Tables keep their rows, columns and cells in more entries; see `./table`.
 * Props a block type merges item by item are maps too; see `./merged-props`.
 */

export type YBlock = Y.Map<unknown>

const ROOT = '\u0000root'

const parentKey = (parent: string | null) => parent ?? ROOT

/** The place of every block as the editor shows it, read from the document. */
interface Placed {
  /** The content node (paragraph, heading, …). */
  content: PMNode
  parent: string | null
}

interface Index {
  blocks: Map<string, Placed>
  /** Child ids in order, by parent (`ROOT` for the top level). */
  children: Map<string, string[]>
}

function indexDoc(doc: PMNode): Index {
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
    children.set(parentKey(parent), ids)
  }
  visit(doc, null)
  return { blocks, children }
}

/** The content node a stored block stands for. Unknown types become paragraphs. */
function contentFrom(yblock: YBlock, schema: Schema): PMNode {
  const name = yblock.get('type') as string
  const known = schema.nodes[name]
  const type = known?.isInGroup('blockContent') ? known : schema.nodes.paragraph!
  const stored = yblock.get('props') as Y.Map<unknown> | undefined
  const props = stored?.toJSON() ?? {}
  const merged = mergedPropsOf(type)
  const attrs: Attributes = {}
  for (const attr of Object.keys(type.spec.attrs ?? {})) {
    if (!(attr in props)) continue
    const spec = merged?.[attr]
    attrs[attr] = spec ? readMerged(stored!.get(attr), spec) : props[attr]
  }
  if (type.spec.rows) return readTable(yblock, type, attrs)
  if (!type.inlineContent) return type.create(attrs)
  const text = yblock.get('text') as Y.Text | undefined
  const inline = text ? inlineFrom(text, schema, !!type.spec.code) : []
  return type.createChecked(attrs, inline.length ? Fragment.from(inline) : null)
}

function writeContent(yblock: YBlock, content: PMNode) {
  yblock.set('type', content.type.name)
  const text = new Y.Text()
  yblock.set('text', text)
  if (content.type.spec.rows) {
    writeTable(yblock, null, content)
    return
  }
  const props = new Y.Map<unknown>()
  const merged = mergedPropsOf(content.type)
  yblock.set('props', props)
  for (const [name, value] of Object.entries(content.attrs)) {
    const spec = merged?.[name]
    props.set(name, spec ? newMerged(value, spec) : value)
  }
  if (content.inlineContent) insertInline(text, 0, content, 0, content.content.size)
}

/**
 * Bring a stored block's type, props and text from `before` to `after`.
 * Returns whether the stored block holds more than `after` shows (see `writeTable`).
 */
function updateContent(yblock: YBlock, before: PMNode, after: PMNode): boolean {
  if (before.type !== after.type) yblock.set('type', after.type.name)
  if (after.type.spec.rows)
    return writeTable(yblock, before.type === after.type ? before : null, after)
  clearTable(yblock)
  const props = yblock.get('props') as Y.Map<unknown>
  const merged = mergedPropsOf(after.type)
  for (const [name, value] of Object.entries(after.attrs)) {
    const spec = merged?.[name]
    if (spec)
      writeMerged(
        props,
        name,
        spec,
        value,
        before.type === after.type ? before.attrs[name] : undefined,
      )
    else if (JSON.stringify(props.get(name)) !== JSON.stringify(value)) props.set(name, value)
  }
  for (const name of Array.from(props.keys())) if (!(name in after.attrs)) props.delete(name)

  const text = yblock.get('text') as Y.Text
  if (!after.inlineContent) {
    if (text.length) text.delete(0, text.length)
    return false
  }
  updateText(text, before, after)
  return false
}

/* the stored tree → document */

/**
 * Where every stored block goes. A parent that no longer exists (deleted
 * while someone moved a block into it) leaves the block at the top level;
 * a cycle (two blocks moved into each other at the same time) is broken at
 * its smallest id. Every client reads the same data the same way, so all
 * end up with the same tree.
 */
function placeAll(map: Y.Map<YBlock>): Map<string, string[]> {
  const parentOf = new Map<string, string | null>()
  map.forEach((yblock, id) => {
    const parent = yblock.get('parent') as string | null | undefined
    parentOf.set(id, parent && parent !== id && map.has(parent) ? parent : null)
  })
  const settled = new Set<string>()
  for (const id of parentOf.keys()) {
    const path: string[] = []
    const onPath = new Set<string>()
    let current: string | null = id
    while (current !== null && !settled.has(current)) {
      if (onPath.has(current)) {
        const cycle = path.slice(path.indexOf(current))
        // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy
        const breakAt = [...cycle].sort()[0]!
        parentOf.set(breakAt, null)
        break
      }
      path.push(current)
      onPath.add(current)
      current = parentOf.get(current) ?? null
    }
    for (const visited of path) settled.add(visited)
  }
  const children = new Map<string, string[]>()
  for (const [id, parent] of parentOf) {
    const key = parentKey(parent)
    const list = children.get(key)
    if (list) list.push(id)
    else children.set(key, [id])
  }
  const orderOf = (id: string) => (map.get(id)!.get('order') as string | undefined) ?? ''
  for (const list of children.values()) {
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts our own list
    list.sort((a, b) => {
      const x = orderOf(a)
      const y = orderOf(b)
      return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0
    })
  }
  return children
}

/** Whether `$pos` is inside table structure below `depth`. */
function inTable($pos: ResolvedPos, depth: number) {
  for (let d = $pos.depth; d > depth; d--) if ($pos.node(d).type.spec.tableRole) return true
  return false
}

/** A position as its table cell and offset in it, if it is in one. */
function cellPlace(doc: PMNode, pos: number) {
  const info = blockAround(doc.resolve(pos))
  if (!info?.content.type.spec.rows) return null
  const cell = cellAt(info.content, pos - info.contentPos - 1)
  return cell && { block: info.node.attrs.id as string, ...cell }
}

/** Put a cursor that was in a replaced table back into its cell. */
function keepCellSelection(state: EditorState, tr: Transaction) {
  const { selection } = state
  if (!(selection instanceof TextSelection)) return
  const back = (pos: number) => {
    const place = cellPlace(state.doc, pos)
    if (!place) return null
    const info = findBlockById(tr.doc, place.block)
    const cell = info && cellStart(info.content, place.key)
    return cell ? info.contentPos + 1 + cell.offset + Math.min(place.index, cell.size) : null
  }
  const anchor = back(selection.anchor)
  const head = back(selection.head)
  if (anchor !== null && head !== null) tr.setSelection(TextSelection.create(tr.doc, anchor, head))
}

/* the binding */

export const collaborationKey = new PluginKey<{
  remote: boolean
  tracked: boolean
  /** An undo step of its own (`transact`). */
  own: boolean
  /** Joins the undo step before (the frames of a drag on a whiteboard). */
  join: boolean
}>('dou-editor-collaboration')

export interface Binding {
  map: Y.Map<YBlock>
  /** The origin of this editor's own changes; the undo manager tracks it. */
  origin: object
  /** The origin of changes that are not undone (`setBlocks`, fixes). */
  untracked: object
  view: EditorView | null
  /** Ends the current undo step, so a structural change is undone on its own. */
  stopCapturing?: () => void
  /** Makes the next change join the current undo step. */
  joinCapturing?: () => void
  /** Where the cursor was before the change being written, for undo to return to. */
  selectionBefore?: unknown
  /** Set while the undo manager takes a step back or forward. */
  undoing?: 'undo' | 'redo'
}

export function createBinding(map: Y.Map<YBlock>): Binding {
  return { map, origin: { binding: 'tracked' }, untracked: { binding: 'untracked' }, view: null }
}

/** Write the blocks of `doc` into an empty map. */
export function writeDoc(map: Y.Map<YBlock>, doc: PMNode) {
  const index = indexDoc(doc)
  map.doc!.transact(() => {
    for (const [key, ids] of index.children) {
      const keys = keysBetween(null, null, ids.length)
      ids.forEach((id, i) => {
        const yblock = new Y.Map<unknown>()
        map.set(id, yblock)
        yblock.set('parent', key === ROOT ? null : key)
        yblock.set('order', keys[i])
        writeContent(yblock, index.blocks.get(id)!.content)
      })
    }
  })
}

/**
 * Write the changes from `before` to `after` into the map: the content of
 * blocks that changed, blocks added and removed, and the places of the
 * blocks that moved. Returns the blocks that hold more than `after` shows,
 * to be read back (see `writeTable`). Call it inside a transaction.
 */
function writeChanges(map: Y.Map<YBlock>, before: Index, after: Index, schema: Schema): string[] {
  const stale: string[] = []
  for (const [id, placed] of after.blocks) {
    const yblock = map.get(id)
    const old = before.blocks.get(id)
    if (!yblock) {
      const created = new Y.Map<unknown>()
      map.set(id, created)
      writeContent(created, placed.content)
    } else if (old && old.content !== placed.content) {
      if (updateContent(yblock, old.content, placed.content)) stale.push(id)
    } else if (!old) {
      // stored, but not shown before (e.g. the empty placeholder came back)
      if (updateContent(yblock, contentFrom(yblock, schema), placed.content)) stale.push(id)
    }
  }
  for (const id of before.blocks.keys()) if (!after.blocks.has(id)) map.delete(id)
  // places: only lists that changed, and only the blocks that moved in them
  for (const [key, ids] of after.children) {
    const old = before.children.get(key)
    if (old && old.length === ids.length && old.every((id, i) => ids[i] === id)) {
      if (ids.every((id) => map.get(id)!.get('order') !== undefined)) continue
    }
    const parent = key === ROOT ? null : key
    const keys = ids.map((id) => {
      const yblock = map.get(id)!
      const order = yblock.get('order') as string | undefined
      return yblock.get('parent') === parent && order !== undefined ? order : null
    })
    const next = orderKeys(keys)
    ids.forEach((id, index) => {
      if (keys[index] === next[index]) return
      const yblock = map.get(id)!
      if (yblock.get('parent') !== parent) yblock.set('parent', parent)
      yblock.set('order', next[index])
    })
  }
  return stale
}

/* writing a new version from elsewhere, without an editor (`updateMap`) */

/** The content node of block `id`. */
const contentOf = (index: Index, id: string) => index.blocks.get(id)!.content

/** A content node as a string, to tell equal blocks apart quickly. */
const keyOf = (content: PMNode) => JSON.stringify(content.toJSON())

/**
 * Pairs of `a` and `b` with equal keys, in the order of both: the equal
 * start and end, then in the middle each of `a` with the first free equal
 * one of `b`, keeping the longest run in order. Indexes into `a` and `b`;
 * about linear, so a long document stays fast.
 */
function equalPairs(a: string[], b: string[]): [number, number][] {
  const pairs: [number, number][] = []
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) {
    pairs.push([start, start])
    start++
  }
  let endA = a.length
  let endB = b.length
  const tail: [number, number][] = []
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
    tail.push([endA, endB])
  }
  // the middle: each of `a` takes the first free equal one of `b`, then the
  // longest run increasing in `b` stays
  const free = new Map<string, number[]>()
  for (let j = endB - 1; j >= start; j--) {
    const list = free.get(b[j]!)
    if (list) list.push(j)
    else free.set(b[j]!, [j])
  }
  const middle: [number, number][] = []
  for (let i = start; i < endA; i++) {
    const j = free.get(a[i]!)?.pop()
    if (j !== undefined) middle.push([i, j])
  }
  const kept = keptIndexes(middle.map(([, j]) => String(j).padStart(10, '0')))
  middle.forEach((pair, index) => kept.has(index) && pairs.push(pair))
  for (let k = tail.length - 1; k >= 0; k--) pairs.push(tail[k]!)
  return pairs
}

/** How alike two texts are, 0 to 1, by the pairs of letters they share. */
function likeness(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const pairs = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i++) {
    const pair = a.slice(i, i + 2)
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1)
  }
  let shared = 0
  for (let i = 0; i < b.length - 1; i++) {
    const pair = b.slice(i, i + 2)
    const left = pairs.get(pair)
    if (left) {
      shared++
      pairs.set(pair, left - 1)
    }
  }
  return (2 * shared) / (a.length + b.length - 2)
}

/** How alike two blocks must be to count as one edited. */
const ALIKE = 0.4
/** How many stored blocks ahead a block is looked for between two equal ones. */
const LOOK_AHEAD = 32
/** How alike a block moved out of its order must be to count as the same one edited. */
const MOVED_ALIKE = 0.8
/** The most comparisons spent on blocks moved out of their order. */
const MOVED_PAIRS = 40_000

/**
 * Which block of `before` each block of `after` stands for: by id when it
 * keeps one, otherwise by place among the blocks of the same parent: first
 * the blocks with equal content, kept in order, then between those, each
 * block with the most alike one of its type further on (its text is
 * changed in place). A block with nothing alike enough is new. Returns
 * new id → old id.
 */
function matchBlocks(before: Index, after: Index): Map<string, string> {
  const match = new Map<string, string>()
  const used = new Set<string>()
  for (const id of after.blocks.keys())
    if (before.blocks.has(id)) {
      match.set(id, id)
      used.add(id)
    }
  const pair = (a: string, b: string) => {
    match.set(a, b)
    used.add(b)
  }
  const visit = (key: string, oldKey: string | null) => {
    const ids = after.children.get(key) ?? []
    const fresh = ids.filter((id) => !match.has(id))
    const olds = (oldKey === null ? [] : (before.children.get(oldKey) ?? [])).filter(
      (id) => !used.has(id),
    )
    const anchors = equalPairs(
      fresh.map((id) => keyOf(contentOf(after, id))),
      olds.map((id) => keyOf(contentOf(before, id))),
    )
    let i = 0
    let j = 0
    for (const [ai, aj] of [...anchors, [fresh.length, olds.length] as [number, number]]) {
      // between two equal blocks: each takes the most alike block of its type ahead
      for (; i < ai; i++) {
        const node = contentOf(after, fresh[i]!)
        const text = node.textContent
        let best = -1
        let score = ALIKE
        for (let k = j; k < Math.min(aj, j + LOOK_AHEAD); k++) {
          const old = contentOf(before, olds[k]!)
          if (old.type !== node.type) continue
          const like = likeness(text, old.textContent)
          if (like > score || (best < 0 && like >= score)) {
            best = k
            score = like
          }
        }
        if (best >= 0) {
          pair(fresh[i]!, olds[best]!)
          j = best + 1
        }
      }
      if (ai < fresh.length) pair(fresh[ai]!, olds[aj]!)
      i = ai + 1
      j = aj + 1
    }
    // what is left: blocks moved past others, e.g. paragraphs put in another order;
    // the same content first, then very alike text, wherever it is in the list
    const leftNew = fresh.filter((id) => !match.has(id))
    const leftOld = olds.filter((id) => !used.has(id))
    if (leftNew.length && leftOld.length) {
      const byKey = new Map<string, string[]>()
      // last first, so `pop` takes them in order
      for (let k = leftOld.length - 1; k >= 0; k--) {
        const id = leftOld[k]!
        const text = keyOf(contentOf(before, id))
        const list = byKey.get(text)
        if (list) list.push(id)
        else byKey.set(text, [id])
      }
      const rest: string[] = []
      for (const id of leftNew) {
        const old = byKey.get(keyOf(contentOf(after, id)))?.pop()
        if (old) pair(id, old)
        else rest.push(id)
      }
      if (rest.length * leftOld.length <= MOVED_PAIRS)
        for (const id of rest) {
          const node = contentOf(after, id)
          let best: string | null = null
          let score = MOVED_ALIKE
          for (const old of leftOld) {
            if (used.has(old) || contentOf(before, old).type !== node.type) continue
            const like = likeness(node.textContent, contentOf(before, old).textContent)
            if (like >= score) {
              best = old
              score = like
            }
          }
          if (best) pair(id, best)
        }
    }
    for (const id of ids) if (after.children.has(id)) visit(id, match.get(id) ?? null)
  }
  visit(ROOT, ROOT)
  return match
}

/**
 * `after` with the comment marks of `before` on the text both start and
 * end with, when `after` has none: a version read from Markdown, which
 * doesn't carry them, leaves the threads where the text stays the same.
 */
function keepComments(before: PMNode, after: PMNode): PMNode {
  const type = after.type.schema.marks.comment
  if (!type || !after.inlineContent || !before.inlineContent || before.type !== after.type)
    return after
  let theirs = false
  after.descendants((node) => {
    if (type.isInSet(node.marks)) theirs = true
  })
  if (theirs) return after
  const ranges: { from: number; to: number; mark: Mark }[] = []
  before.forEach((child, pos) => {
    for (const mark of child.marks)
      if (mark.type === type) ranges.push({ from: pos, to: pos + child.nodeSize, mark })
  })
  if (!ranges.length) return after
  const a = before.textBetween(0, before.content.size, '', '￼')
  const b = after.textBetween(0, after.content.size, '', '￼')
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++
  const tr = new Transform(after)
  const shift = b.length - a.length
  for (const { from, to, mark } of ranges) {
    // the start both share, and the end, moved by what changed between
    if (from < head) tr.addMark(from, Math.min(to, head), mark)
    const end = a.length - tail
    if (to > end) tr.addMark(Math.max(from, end) + shift, to + shift, mark)
  }
  return tr.doc
}

/** Every block id in `index` under `id`, at any depth. */
function descendants(index: Index, id: string, out: string[] = []): string[] {
  for (const child of index.children.get(id) ?? []) {
    out.push(child)
    descendants(index, child, out)
  }
  return out
}

/**
 * Change the map from `base` to `doc`, leaving what changed in the map since
 * `base` was read: blocks of `doc` are matched to those of `base` (see
 * `matchBlocks`), and those of `base` to the stored ones; only blocks that
 * differ between `base` and `doc` are written, removed or moved. Without
 * `base`, the map as it is now. Call it inside a transaction.
 */
export function updateDoc(map: Y.Map<YBlock>, doc: PMNode, schema: Schema, base?: PMNode | null) {
  const current = readDoc(map, schema)
  if (!current) return void writeDoc(map, doc)
  const now = indexDoc(current)
  const from = base ? indexDoc(base) : now
  const to = indexDoc(doc)
  const toBase = matchBlocks(from, to)
  const baseToNow = base ? matchBlocks(now, from) : null
  /** The stored block a block of `base` is now, if it still is. */
  const nowOf = (old: string) => {
    const there = baseToNow ? baseToNow.get(old) : old
    return there !== undefined && now.blocks.has(there) ? there : null
  }
  /** The stored block each block of `doc` is written to. */
  const stored = new Map<string, string>()
  for (const [id, old] of toBase) {
    const there = nowOf(old)
    if (there) stored.set(id, there)
  }
  // removed by someone else since `base`: it stays removed, even if `doc`
  // changed it, and so do the blocks `doc` adds under it
  const gone = new Set<string>()
  const walk = (key: string, inGone: boolean) => {
    for (const id of to.children.get(key) ?? []) {
      const old = toBase.get(id)
      const lost = (old !== undefined && !stored.has(id)) || (inGone && !stored.has(id))
      if (lost) gone.add(id)
      walk(id, lost)
    }
  }
  walk(ROOT, false)
  // ids of `doc` for its new blocks: kept unless the map has them already
  for (const id of to.blocks.keys())
    if (!stored.has(id) && !gone.has(id)) stored.set(id, map.has(id) ? createId() : id)
  const kept = new Set(stored.values())
  const inDoc = new Set(toBase.values())

  // removed: what `base` had and `doc` hasn't, with what is stored under it
  for (const old of from.blocks.keys()) {
    const there = inDoc.has(old) ? null : nowOf(old)
    if (!there) continue
    for (const id of [there, ...descendants(now, there)])
      if (!kept.has(id) && map.has(id)) map.delete(id)
  }

  // content: new blocks written, those changed since `base` brought to `doc`
  for (const [id, placed] of to.blocks) {
    if (gone.has(id)) continue
    const target = stored.get(id)!
    const yblock = map.get(target)
    if (!now.blocks.has(target)) {
      const created = new Y.Map<unknown>()
      map.set(target, created)
      writeContent(created, placed.content)
      continue
    }
    const old = toBase.get(id)
    const was = old !== undefined ? from.blocks.get(old)!.content : null
    if (was && keepComments(was, placed.content).eq(was)) continue
    const there = now.blocks.get(target)!.content
    updateContent(yblock!, there, keepComments(there, placed.content))
  }

  // places: in each list of `doc`, the blocks new there or out of their order in `base`
  for (const [key, all] of to.children) {
    if (gone.has(key)) continue
    const ids = all.filter((id) => !gone.has(id))
    const parent = key === ROOT ? null : stored.get(key)!
    const oldParent = key === ROOT ? ROOT : toBase.get(key)
    const siblings = oldParent === undefined ? [] : (from.children.get(oldParent) ?? [])
    const at = new Map(siblings.map((id, index) => [id, index]))
    const inBase = ids.map((id) => {
      const old = toBase.get(id)
      return old !== undefined && at.has(old) ? String(at.get(old)!).padStart(10, '0') : null
    })
    const stays = keptIndexes(inBase)
    const moved = new Set(ids.filter((_, index) => !stays.has(index)).map((id) => stored.get(id)!))
    if (!moved.size) continue
    // the stored list, without what goes elsewhere, with the moved ones put after their neighbour in `doc`
    const list = (now.children.get(parentKey(parent)) ?? []).filter(
      (id) => map.has(id) && !moved.has(id),
    )
    let previous: string | null = null
    for (const id of ids) {
      const target = stored.get(id)!
      if (moved.has(target))
        list.splice(previous === null ? 0 : list.indexOf(previous) + 1, 0, target)
      if (list.includes(target)) previous = target
    }
    const keys = list.map((id) => {
      const yblock = map.get(id)!
      const order = yblock.get('order') as string | undefined
      return !moved.has(id) && yblock.get('parent') === parent && order !== undefined ? order : null
    })
    const next = orderKeys(keys)
    list.forEach((id, index) => {
      if (keys[index] === next[index]) return
      const yblock = map.get(id)!
      if (yblock.get('parent') !== parent) yblock.set('parent', parent)
      yblock.set('order', next[index])
    })
  }
}

/** The document a map holds, read without an editor; `null` while the map is empty. */
export function readDoc(map: Y.Map<YBlock>, schema: Schema): PMNode | null {
  const children = placeAll(map)
  const build = (id: string): PMNode => {
    const content = contentFrom(map.get(id)!, schema)
    const kids = children.get(id)
    const parts = kids?.length
      ? [content, schema.nodes.blockGroup!.create(null, kids.map(build))]
      : [content]
    return schema.nodes.block!.create({ id }, parts)
  }
  const top = children.get(ROOT) ?? []
  return top.length ? schema.nodes.doc!.create(null, top.map(build)) : null
}

export function syncPlugin(binding: Binding): Plugin {
  const { map } = binding
  const ydoc = map.doc!
  let schema: Schema
  // the document as last written to or read from the map
  let synced: Index | null = null
  // content nodes read from the map, by id, until the block changes there
  const cache = new Map<string, PMNode>()
  let placeholderId = createId()

  function buildDoc(): PMNode {
    const children = placeAll(map)
    const build = (id: string): PMNode => {
      let content = cache.get(id)
      if (!content) {
        content = contentFrom(map.get(id)!, schema)
        cache.set(id, content)
      }
      const kids = children.get(id)
      const parts = kids?.length
        ? [content, schema.nodes.blockGroup!.create(null, kids.map(build))]
        : [content]
      return schema.nodes.block!.create({ id }, parts)
    }
    const top = children.get(ROOT) ?? []
    // an empty map still shows one empty paragraph; it is stored once typed in
    const blocks = top.length
      ? top.map(build)
      : [schema.nodes.block!.create({ id: placeholderId }, schema.nodes.paragraph!.create())]
    return schema.nodes.doc!.create(null, blocks)
  }

  /** Show the map's current state in the editor. */
  function readMap(view: EditorView) {
    const doc = view.state.doc
    const next = buildDoc()
    const start = doc.content.findDiffStart(next.content)
    if (start !== null) {
      const end = doc.content.findDiffEnd(next.content)!
      const overlap = start - Math.min(end.a, end.b)
      if (overlap > 0) {
        end.a += overlap
        end.b += overlap
      }
      let from = start
      let to = end.a
      const $from = doc.resolve(from)
      const $to = doc.resolve(to)
      const shared = $from.sharedDepth(to)
      // a change across table cells or rows: swap them whole, a partial cut breaks the grid
      if (!$from.node(shared).inlineContent && (inTable($from, shared) || inTable($to, shared))) {
        if ($from.depth > shared) from = $from.before(shared + 1)
        if ($to.depth > shared) to = $to.after(shared + 1)
      }
      const tail = doc.content.size - to
      const tr = view.state.tr.replace(from, to, next.slice(from, next.content.size - tail))
      if (to !== end.a || from !== start) keepCellSelection(view.state, tr)
      tr.setMeta(collaborationKey, { remote: true })
      tr.setMeta('remote', true)
      // this user's undo comes back through the shared document too
      if (binding.undoing) tr.setMeta(originKey, binding.undoing)
      tr.setMeta('addToHistory', false)
      view.dispatch(tr)
    }
    synced = indexDoc(view.state.doc)
  }

  /** Write the editor's changes since the last sync into the map. */
  function writeMap(view: EditorView, tracked: boolean) {
    const doc = view.state.doc
    const before = synced ?? indexDoc(doc)
    const after = indexDoc(doc)
    // moving, indenting or adding blocks is an undo step of its own
    let structural = false
    for (const [key, ids] of after.children) {
      const old = before.children.get(key)
      if (!old || old.length !== ids.length || old.some((id, i) => ids[i] !== id)) structural = true
    }
    if (structural) binding.stopCapturing?.()
    const stale = ydoc.transact(
      () => writeChanges(map, before, after, schema),
      tracked ? binding.origin : binding.untracked,
    )
    for (const id of after.blocks.keys()) cache.set(id, after.blocks.get(id)!.content)
    for (const id of before.blocks.keys()) if (!after.blocks.has(id)) cache.delete(id)
    if (structural) binding.stopCapturing?.()
    synced = after
    if (stale.length) {
      for (const id of stale) cache.delete(id)
      // not from inside this update: show the rest once it is done
      queueMicrotask(() => {
        if (binding.view === view) readMap(view)
      })
    }
  }

  return new Plugin({
    key: collaborationKey,
    state: {
      init: () => ({ remote: false, tracked: false, own: false, join: false }),
      apply(tr, value) {
        const meta = tr.getMeta(collaborationKey) as { remote?: boolean } | undefined
        if (!tr.docChanged) return value
        if (meta?.remote) return { remote: true, tracked: false, own: false, join: false }
        // a transaction can come with appended ones (e.g. id fixes), written
        // together: undone together if any of them is
        const tracked = tr.getMeta('addToHistory') !== false
        const own = tr.getMeta(ownStepKey) === true
        const join = tr.getMeta(joinStepKey) === true
        // a step joined on purpose stands on its own here (its
        // `appendedTransaction` is for the built-in history)
        const appended = !join && !!tr.getMeta('appendedTransaction') && !value.remote
        return appended
          ? {
              remote: false,
              tracked: value.tracked || tracked,
              own: value.own || own,
              join: value.join || join,
            }
          : { remote: false, tracked, own, join }
      },
    },
    view(view) {
      schema = view.state.schema
      binding.view = view
      const observer = (
        events: Y.YEvent<Y.AbstractType<unknown>>[],
        transaction: Y.Transaction,
      ) => {
        if (transaction.origin === binding.origin || transaction.origin === binding.untracked)
          return
        // forget the cached content of every block that changed
        for (const event of events) {
          if (event.target === map) {
            for (const id of (event as Y.YMapEvent<unknown>).keysChanged) cache.delete(id)
            continue
          }
          // the path from the map starts with the block's id
          const id = event.path[0]
          if (typeof id === 'string') cache.delete(id)
        }
        readMap(view)
      }
      map.observeDeep(observer)
      if (map.size) readMap(view)
      else synced = indexDoc(view.state.doc)
      placeholderId = (view.state.doc.firstChild?.attrs.id as string | undefined) ?? placeholderId
      return {
        update(current, previous: EditorState) {
          if (current.state.doc === previous.doc) return
          const state = collaborationKey.getState(current.state)!
          if (state.remote) {
            synced = indexDoc(current.state.doc)
            return
          }
          // read before writing: the map still holds the previous text
          binding.selectionBefore = placeOf(binding, previous.doc, previous.selection.head)
          if (state.own) binding.stopCapturing?.()
          else if (state.join) binding.joinCapturing?.()
          writeMap(current, state.tracked)
          if (state.own) binding.stopCapturing?.()
        },
        destroy() {
          map.unobserveDeep(observer)
          binding.view = null
        },
      }
    },
  })
}

export type { Transaction }
