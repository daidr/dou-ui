import { InputRule, inputRules } from 'prosemirror-inputrules'
import type { MarkType, NodeType, Schema } from 'prosemirror-model'
import { TextSelection, type Plugin } from 'prosemirror-state'
import { blockAround } from './blocks'

/**
 * Markdown-style shortcuts typed at the start of a block: `# ` for a
 * heading, `- ` for a list, `[] ` for a to-do and so on. They only apply
 * to paragraphs, so typing `# ` inside a heading or code stays literal.
 * Input rules never run during IME composition.
 */
function blockRule(pattern: RegExp, type: NodeType, attrs?: (match: RegExpMatchArray) => object) {
  return new InputRule(pattern, (state, match, start, end) => {
    const $start = state.doc.resolve(start)
    if ($start.parent.type.name !== 'paragraph') return null
    const tr = state.tr.delete(start, end)
    tr.setBlockType(start, start, type, attrs?.(match) ?? null)
    return tr
  })
}

/** `---` on its own turns the block into a divider and opens a paragraph below. */
function dividerRule(schema: Schema) {
  return new InputRule(/^(?:---|___|\*\*\*)$/, (state, _match, start) => {
    const $start = state.doc.resolve(start)
    if ($start.parent.type.name !== 'paragraph' || $start.parent.content.size !== 2) return null
    const info = blockAround($start)
    if (!info || info.group) return null
    const tr = state.tr.replaceWith(
      info.contentPos,
      info.contentPos + info.content.nodeSize,
      schema.nodes.divider!.create(),
    )
    const at = info.pos + tr.doc.nodeAt(info.pos)!.nodeSize
    tr.insert(at, schema.nodes.block!.create({ id: null }, schema.nodes.paragraph!.create()))
    tr.setSelection(TextSelection.create(tr.doc, at + 2))
    return tr
  })
}

/**
 * `**bold**`, `*italic*`, `~~strike~~` and `` `code` `` as you type. The
 * pattern's first group is the marked text with its markers, the second
 * the text alone. The character just typed (the last marker) is not in
 * the document yet.
 */
function markRule(pattern: RegExp, type: MarkType) {
  return new InputRule(pattern, (state, match, start, end) => {
    const [all, marked, text] = match
    if (!all || !marked || !text) return null
    if (state.doc.resolve(start).parent.type.spec.code) return null
    const from = start + all.length - marked.length
    const marker = (marked.length - text.length) / 2
    const tr = state.tr
      .delete(from + marker + text.length, end)
      .delete(from, from + marker)
      .addMark(from, from + text.length, type.create())
      .removeStoredMark(type)
    return tr
  })
}

export function editorInputRules(schema: Schema): Plugin {
  const nodes = schema.nodes
  const marks = schema.marks
  return inputRules({
    rules: [
      blockRule(/^(#{1,3})\s$/, nodes.heading!, (match) => ({ level: match[1]!.length })),
      blockRule(/^[-*+]\s$/, nodes.bulletItem!),
      blockRule(/^1[.)]\s$/, nodes.numberedItem!),
      blockRule(/^\[( |x)?\]\s$/i, nodes.checkItem!, (match) => ({
        checked: match[1]?.toLowerCase() === 'x',
      })),
      blockRule(/^>\s$/, nodes.quote!),
      blockRule(/^```$/, nodes.codeBlock!),
      dividerRule(schema),
      markRule(/(?:^|[^*])(\*\*([^*\s](?:[^*]*[^*\s])?)\*\*)$/, marks.bold!),
      markRule(/(?:^|[^*])(\*([^*\s](?:[^*]*[^*\s])?)\*)$/, marks.italic!),
      markRule(/(?:^|[^~])(~~([^~\s](?:[^~]*[^~\s])?)~~)$/, marks.strike!),
      markRule(/(?:^|[^`])(`([^`\s](?:[^`]*[^`\s])?)`)$/, marks.code!),
    ],
  })
}
