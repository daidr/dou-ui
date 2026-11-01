import { Mark, type Node as PMNode, type Schema } from 'prosemirror-model'
import type * as Y from 'yjs'

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
