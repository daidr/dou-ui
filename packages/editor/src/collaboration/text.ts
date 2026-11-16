import { Mark, type Node as PMNode, type Schema } from 'prosemirror-model'
import type * as Y from 'yjs'
import { Mapping, StepMap, Transform } from 'prosemirror-transform'
import { diffLists } from './inline-diff'

/* inline content ↔ Y.Text */

export type Attributes = Record<string, unknown>

/*
 * A text can be in several comment threads at once, each added and
 * removed on its own, also by two people at the same time: every thread
 * is its own attribute, `comment:<thread id>`.
 */
const COMMENT = 'comment'
const COMMENT_PREFIX = 'comment:'

export function markAttributes(marks: readonly Mark[], schema: Schema): Attributes {
  // every mark is named, so `insert` doesn't inherit formatting from the left
  // (comment attributes the text doesn't have are cleared by `insert` itself)
  const attributes: Attributes = {}
  for (const name of Object.keys(schema.marks)) if (name !== COMMENT) attributes[name] = null
  for (const mark of marks) {
    if (mark.type.name === COMMENT) attributes[COMMENT_PREFIX + mark.attrs.id] = true
    else attributes[mark.type.name] = Object.keys(mark.attrs).length ? { ...mark.attrs } : true
  }
  return attributes
}

/** The comment attributes of the inline content from `from` to `to`. */
function commentAttributes(node: PMNode, from: number, to: number): Set<string> {
  const keys = new Set<string>()
  node.nodesBetween(from, to, (child) => {
    for (const mark of child.marks)
      if (mark.type.name === COMMENT) keys.add(COMMENT_PREFIX + mark.attrs.id)
  })
  return keys
}

interface Embed {
  node: string
  attrs?: Attributes
}

/** Write `content`'s inline nodes from `from` to `to` into `text` at `at`. */
export function insertInline(text: Y.Text, at: number, content: PMNode, from: number, to: number) {
  const schema = content.type.schema
  let offset = at
  content.forEach((child, pos) => {
    const start = Math.max(pos, from)
    const end = Math.min(pos + child.nodeSize, to)
    if (start >= end) return
    if (child.isText) {
      const piece = child.text!.slice(start - pos, end - pos)
      text.insert(offset, piece, markAttributes(child.marks, schema))
      offset += piece.length
    } else {
      const embed: Embed = { node: child.type.name }
      if (Object.keys(child.attrs).length) embed.attrs = { ...child.attrs }
      text.insertEmbed(offset, embed, markAttributes(child.marks, schema))
      offset += 1
    }
  })
}

function marksFrom(attributes: Attributes | undefined, schema: Schema): Mark[] {
  const marks: Mark[] = []
  for (const [name, value] of Object.entries(attributes ?? {})) {
    if (name.startsWith(COMMENT_PREFIX)) {
      if (value === true && schema.marks[COMMENT])
        marks.push(schema.marks[COMMENT].create({ id: name.slice(COMMENT_PREFIX.length) }))
      continue
    }
    const type = schema.marks[name]
    if (!type || value === null || value === undefined) continue
    marks.push(type.create(value === true ? null : (value as Attributes)))
  }
  return Mark.setFrom(marks) as Mark[]
}

export function inlineFrom(text: Y.Text, schema: Schema, code: boolean): PMNode[] {
  const nodes: PMNode[] = []
  for (const op of text.toDelta() as { insert: string | Embed; attributes?: Attributes }[]) {
    if (typeof op.insert === 'string') {
      if (op.insert)
        nodes.push(schema.text(op.insert, code ? [] : marksFrom(op.attributes, schema)))
    } else {
      const type = schema.nodes[op.insert.node]
      if (type?.isInline)
        nodes.push(type.create(op.insert.attrs ?? null, null, marksFrom(op.attributes, schema)))
    }
  }
  return nodes
}

/** Bring `text` from `before`'s inline content to `after`'s, changing only what differs. */
export function updateText(text: Y.Text, before: PMNode, after: PMNode) {
  const start = before.content.findDiffStart(after.content)
  if (start === null) return
  const end = before.content.findDiffEnd(after.content)!
  // the ends can overlap the start when the change repeats nearby text
  const overlap = start - Math.min(end.a, end.b)
  if (overlap > 0) {
    end.a += overlap
    end.b += overlap
  }
  const sameText =
    end.a - start === end.b - start &&
    before.textBetween(start, end.a, '\n', '￼') === after.textBetween(start, end.b, '\n', '￼')
  if (sameText) {
    // only the formatting changed: keep the characters, so edits on them merge
    const schema = after.type.schema
    const comments = commentAttributes(before, start, end.a)
    after.content.forEach((child, pos) => {
      const from = Math.max(pos, start)
      const to = Math.min(pos + child.nodeSize, end.b)
      if (from >= to) return
      const attributes = markAttributes(child.marks, schema)
      // threads taken off this text
      for (const key of comments) if (!(key in attributes)) attributes[key] = null
      text.format(from, to - from, attributes)
    })
    return
  }
  if (end.a > start) text.delete(start, end.a - start)
  if (end.b > start) insertInline(text, start, after, start, end.b)
}

/** Inline characters and embeds, with offsets matching ProseMirror and Y.Text. */
function units(node: PMNode): string[] {
  const result: string[] = []
  node.forEach((child) => {
    if (child.isText)
      for (let i = 0; i < child.text!.length; i++) result.push('t:' + child.text![i])
    else result.push('n:' + JSON.stringify([child.type.name, child.attrs]))
  })
  return result
}

const markKey = (mark: Mark) =>
  mark.type.name === COMMENT ? COMMENT_PREFIX + mark.attrs.id : mark.type.name

const markRuns = (node: PMNode) => {
  const result: { end: number; marks: readonly Mark[] }[] = []
  node.forEach((child, at) => result.push({ end: at + child.nodeSize, marks: child.marks }))
  return result
}

type InlineChange = [number, number, number, number]
const mappingOf = (changes: InlineChange[]) => {
  const mapping = new Mapping()
  let shift = 0
  for (const [from, to, start, end] of changes) {
    mapping.appendMap(new StepMap([from + shift, to - from, end - start]))
    shift += end - start - (to - from)
  }
  return mapping
}

/**
 * Apply base → written edits to the current inline content. Offsets are
 * mapped through the room's edits first; overlapping replacements use
 * written content, while edits elsewhere and their marks remain intact.
 */
export function updateTextFromBase(text: Y.Text, base: PMNode, written: PMNode, current: PMNode) {
  if (base.content.eq(current.content)) return updateText(text, current, written)
  if (base.content.eq(written.content)) return
  const a = units(base)
  const b = units(written)
  const remote = diffLists(a, units(current), 256)
  const own = diffLists(a, b, 256)
  const roomMap = mappingOf(remote)
  const writtenMap = mappingOf(own)
  // An edit inside a replacement conflicts with that replacement as a
  // whole. Join such edits before mapping, so their ranges cannot cross.
  const ranges: { from: number; to: number }[] = []
  let remoteAt = 0
  for (const [start, end] of own) {
    let from = start
    let to = end
    while (remoteAt < remote.length && remote[remoteAt]![1] <= from) remoteAt++
    for (let i = remoteAt; i < remote.length; i++) {
      const [left, right] = remote[i]!
      if (left >= to) break
      if (left < to && right > from) {
        from = Math.min(from, left)
        to = Math.max(to, right)
      }
    }
    const last = ranges[ranges.length - 1]
    if (last && from <= last.to) last.to = Math.max(last.to, to)
    else ranges.push({ from, to })
  }
  const tr = new Transform(current)
  for (let i = ranges.length - 1; i >= 0; i--) {
    const { from, to } = ranges[i]!
    const start = roomMap.map(from, 1)
    const end = Math.max(start, roomMap.map(to, -1))
    const writtenStart = writtenMap.map(from, -1)
    const writtenEnd = writtenMap.map(to, 1)
    tr.replaceWith(start, end, written.content.cut(writtenStart, writtenEnd))
    if (end > start) text.delete(start, end - start)
    if (writtenEnd > writtenStart) insertInline(text, start, written, writtenStart, writtenEnd)
  }
  // Formatting is a field change, not a text replacement. Only marks
  // actually changed by the writer are applied to surviving characters.
  let formatted = false
  base.forEach((node) => {
    formatted ||= node.marks.length > 0
  })
  written.forEach((node) => {
    formatted ||= node.marks.length > 0
  })
  if (!formatted) return
  let run: { from: number; to: number; remove: Mark[]; add: Mark[]; key: string } | null = null
  const flush = () => {
    if (!run) return
    const attributes: Attributes = {}
    for (const mark of run.remove) attributes[markKey(mark)] = null
    for (const mark of run.add)
      attributes[markKey(mark)] =
        mark.type.name === COMMENT || !Object.keys(mark.attrs).length ? true : { ...mark.attrs }
    text.format(run.from, run.to - run.from, attributes)
    run = null
  }
  const baseRuns = markRuns(base)
  const writtenRuns = markRuns(written)
  let baseRun = 0
  let writtenRun = 0
  let changed = 0
  for (let i = 0; i < a.length; i++) {
    while (changed < own.length && own[changed]![1] <= i) changed++
    if (changed < own.length && own[changed]![0] <= i && i < own[changed]![1]) continue
    const j = writtenMap.map(i, 1)
    while (baseRuns[baseRun] && baseRuns[baseRun]!.end <= i) baseRun++
    while (writtenRuns[writtenRun] && writtenRuns[writtenRun]!.end <= j) writtenRun++
    const was = baseRuns[baseRun]?.marks ?? []
    const next = writtenRuns[writtenRun]?.marks ?? []
    const old = new Map(was.map((mark) => [markKey(mark), mark]))
    const fresh = new Map(next.map((mark) => [markKey(mark), mark]))
    const remove = was.filter((mark) => !fresh.get(markKey(mark))?.eq(mark))
    const add = next.filter((mark) => !old.get(markKey(mark))?.eq(mark))
    if (!remove.length && !add.length) continue
    const from = tr.mapping.map(roomMap.map(i, 1), 1)
    const to = tr.mapping.map(roomMap.map(i + 1, -1), -1)
    if (to <= from) continue
    const key = JSON.stringify([
      remove.map((mark) => mark.toJSON()),
      add.map((mark) => mark.toJSON()),
    ])
    if (run && run.to === from && run.key === key) run.to = to
    else {
      flush()
      run = { from, to, remove, add, key }
    }
  }
  flush()
}
