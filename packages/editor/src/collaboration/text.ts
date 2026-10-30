import { Mark, type Node as PMNode, type Schema } from 'prosemirror-model'
import type * as Y from 'yjs'

/* inline content ↔ Y.Text */

export type Attributes = Record<string, unknown>

export function markAttributes(marks: readonly Mark[], schema: Schema): Attributes {
  // every mark is named, so `insert` doesn't inherit formatting from the left
  const attributes: Attributes = {}
  for (const name of Object.keys(schema.marks)) attributes[name] = null
  for (const mark of marks)
    attributes[mark.type.name] = Object.keys(mark.attrs).length ? { ...mark.attrs } : true
  return attributes
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
    after.content.forEach((child, pos) => {
      const from = Math.max(pos, start)
      const to = Math.min(pos + child.nodeSize, end.b)
      if (from < to) text.format(from, to - from, markAttributes(child.marks, schema))
    })
    return
  }
  if (end.a > start) text.delete(start, end.a - start)
  if (end.b > start) insertInline(text, start, after, start, end.b)
}
