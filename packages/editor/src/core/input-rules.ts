import { InputRule, inputRules } from 'prosemirror-inputrules'
import { TextSelection, type Plugin } from 'prosemirror-state'
import { blockAround } from './blocks'

/**
 * A Markdown-style shortcut typed at the start of a block, e.g. `# ` for a
 * heading. It only applies to paragraphs, so typing `# ` inside a heading
 * or code stays literal. Input rules never run during IME composition.
 */
export function blockInputRule(
  pattern: RegExp,
  type: string,
  attrs?: (match: RegExpMatchArray) => Record<string, unknown>,
) {
  return new InputRule(pattern, (state, match, start, end) => {
    const nodeType = state.schema.nodes[type]
    const $start = state.doc.resolve(start)
    if (!nodeType || $start.parent.type.name !== 'paragraph') return null
    const tr = state.tr.delete(start, end)
    tr.setBlockType(start, start, nodeType, attrs?.(match) ?? null)
    return tr
  })
}

/**
 * A shortcut that fills an empty paragraph with a block without text (e.g.
 * `---` for a divider) and opens a paragraph below. The pattern matches the
 * whole paragraph, the character just typed included.
 */
export function atomInputRule(pattern: RegExp, type: string) {
  return new InputRule(pattern, (state, match, start) => {
    const nodeType = state.schema.nodes[type]
    const $start = state.doc.resolve(start)
    // the last character is not in the document yet
    if (!nodeType || $start.parent.type.name !== 'paragraph') return null
    if ($start.parent.content.size !== match[0]!.length - 1) return null
    const info = blockAround($start)
    if (!info || info.group) return null
    const tr = state.tr.replaceWith(
      info.contentPos,
      info.contentPos + info.content.nodeSize,
      nodeType.create(),
    )
    const at = info.pos + tr.doc.nodeAt(info.pos)!.nodeSize
    tr.insert(
      at,
      state.schema.nodes.block!.create({ id: null }, state.schema.nodes.paragraph!.create()),
    )
    tr.setSelection(TextSelection.create(tr.doc, at + 2))
    return tr
  })
}

/**
 * Formatting typed inline, e.g. `**bold**`. The pattern's first group is
 * the marked text with its markers, the second the text alone. The
 * character just typed (the last marker) is not in the document yet.
 */
export function markInputRule(pattern: RegExp, mark: string) {
  return new InputRule(pattern, (state, match, start, end) => {
    const type = state.schema.marks[mark]
    const [all, marked, text] = match
    if (!type || !all || !marked || !text) return null
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

export function editorInputRules(rules: InputRule[]): Plugin {
  return inputRules({ rules })
}
