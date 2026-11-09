import { Fragment, type Node as PMNode, type ResolvedPos, type Schema } from 'prosemirror-model'
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
import { ownStepKey } from '../core/transaction'
import { placeOf } from './cursors'
import { keysBetween, orderKeys } from './order'
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
  const props = (yblock.get('props') as Y.Map<unknown> | undefined)?.toJSON() ?? {}
  const attrs: Attributes = {}
  for (const attr of Object.keys(type.spec.attrs ?? {}))
    if (attr in props) attrs[attr] = props[attr]
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
  for (const [name, value] of Object.entries(content.attrs)) props.set(name, value)
  yblock.set('props', props)
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
  for (const [name, value] of Object.entries(after.attrs)) {
    if (JSON.stringify(props.get(name)) !== JSON.stringify(value)) props.set(name, value)
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

/** The longest run of pairs `same` holds for, in order: indexes into `a` and `b`. */
function commonPairs<T, U>(a: T[], b: U[], same: (x: T, y: U) => boolean): [number, number][] {
  const n = a.length
  const m = b.length
  const lengths = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lengths[i]![j] = same(a[i]!, b[j]!)
        ? lengths[i + 1]![j + 1]! + 1
        : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
  const pairs: [number, number][] = []
  for (let i = 0, j = 0; i < n && j < m;) {
    if (same(a[i]!, b[j]!)) pairs.push([i++, j++])
    else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) i++
    else j++
  }
  return pairs
}

/**
 * Which stored block each block of a new document stands for, by id when
 * it keeps one, otherwise by place: among the blocks of the same parent,
 * the most blocks with the same content in the same order, then between
 * them the blocks of the same type one by one (their text is changed in
 * place). New id → stored id; blocks without one are new.
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
    const pairs = commonPairs(fresh, olds, (a, b) =>
      after.blocks.get(a)!.content.eq(before.blocks.get(b)!.content),
    )
    // between equal blocks, those of a type are taken as the same block edited
    let i = 0
    let j = 0
    for (const [pi, pj] of [...pairs, [fresh.length, olds.length] as [number, number]]) {
      for (; i < pi && j < pj; i++, j++) {
        if (after.blocks.get(fresh[i]!)!.content.type !== before.blocks.get(olds[j]!)!.content.type)
          break
        pair(fresh[i]!, olds[j]!)
      }
      if (pi < fresh.length) pair(fresh[pi]!, olds[pj]!)
      i = pi + 1
      j = pj + 1
    }
    for (const id of ids) if (after.children.has(id)) visit(id, match.get(id) ?? null)
  }
  visit(ROOT, ROOT)
  return match
}

/** `doc` with its blocks' ids changed as `ids` says. */
function renamed(doc: PMNode, ids: Map<string, string>): PMNode {
  const rename = (node: PMNode): PMNode => {
    const children: PMNode[] = []
    node.forEach((child) =>
      children.push(
        child.type.name === 'block' || child.type.name === 'blockGroup' ? rename(child) : child,
      ),
    )
    const content = Fragment.from(children)
    if (node.type.name === 'block') {
      const id = node.attrs.id as string
      return node.type.create({ ...node.attrs, id: ids.get(id) ?? id }, content, node.marks)
    }
    return node.copy(content)
  }
  return rename(doc)
}

/**
 * Change the map to hold `doc`, touching only what differs from what it
 * holds now (see `matchBlocks`): text typed elsewhere into the blocks this
 * leaves alone stays. Call it inside a transaction.
 */
export function updateDoc(map: Y.Map<YBlock>, doc: PMNode, schema: Schema) {
  const current = readDoc(map, schema)
  if (!current) return void writeDoc(map, doc)
  const before = indexDoc(current)
  const next = renamed(doc, matchBlocks(before, indexDoc(doc)))
  writeChanges(map, before, indexDoc(next), schema)
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
      init: () => ({ remote: false, tracked: false, own: false }),
      apply(tr, value) {
        const meta = tr.getMeta(collaborationKey) as { remote?: boolean } | undefined
        if (!tr.docChanged) return value
        if (meta?.remote) return { remote: true, tracked: false, own: false }
        // a transaction can come with appended ones (e.g. id fixes), written
        // together: undone together if any of them is
        const tracked = tr.getMeta('addToHistory') !== false
        const own = tr.getMeta(ownStepKey) === true
        const appended = !!tr.getMeta('appendedTransaction') && !value.remote
        return appended
          ? { remote: false, tracked: value.tracked || tracked, own: value.own || own }
          : { remote: false, tracked, own }
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
