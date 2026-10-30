import { Schema, type DOMOutputSpec, type MarkSpec, type NodeSpec } from 'prosemirror-model'

/**
 * The document is a list of blocks. Each block is a `block` node holding
 * one piece of content (a paragraph, a heading, a list item…) and,
 * optionally, a `blockGroup` of child blocks:
 *
 *   doc
 *   └─ block#id
 *      ├─ paragraph "Hello"
 *      └─ blockGroup
 *         └─ block#id
 *            └─ checkItem "Nested"
 *
 * The frame (doc, block, group, paragraph, text, line break) is fixed;
 * every other content type and mark comes from an extension. Every piece
 * of state lives in node attributes (never in a node view), so a
 * collaborative binding can sync it like any other change.
 */

/** The DOM of a content node: `div.dou-editor__content--<type>[data-content-type]`. */
export const contentDOM = (type: string, extra: Record<string, string> = {}): DOMOutputSpec => [
  'div',
  {
    class: `dou-editor__content dou-editor__content--${type}`,
    'data-content-type': type,
    ...extra,
  },
  0,
]

/** A content type holding formatted text, parsed back from its own DOM. */
export const textBlock = (type: string, spec: Partial<NodeSpec> = {}): NodeSpec => ({
  content: 'inline*',
  defining: true,
  parseDOM: [{ tag: `div[data-content-type="${type}"]` }],
  toDOM: () => contentDOM(type),
  ...spec,
})

const frame: Record<string, NodeSpec> = {
  doc: { content: 'block+' },

  block: {
    attrs: { id: { default: null } },
    content: 'blockContent blockGroup?',
    defining: true,
    parseDOM: [
      {
        tag: 'div[data-block-id]',
        getAttrs: (dom) => ({ id: (dom as HTMLElement).dataset.blockId ?? null }),
      },
    ],
    toDOM: (node) => ['div', { class: 'dou-editor__block', 'data-block-id': node.attrs.id }, 0],
  },

  blockGroup: {
    content: 'block+',
    parseDOM: [{ tag: 'div.dou-editor__group' }],
    toDOM: () => ['div', { class: 'dou-editor__group', role: 'group' }, 0],
  },

  paragraph: textBlock('paragraph', {
    group: 'blockContent',
    parseDOM: [{ tag: 'div[data-content-type="paragraph"]' }, { tag: 'p' }],
  }),
}

const inlineFrame: Record<string, NodeSpec> = {
  text: { group: 'inline' },

  hardBreak: {
    inline: true,
    // newlines from a code block become line breaks when it turns into text, and back
    linebreakReplacement: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM: () => ['br'],
  },
}

export interface SchemaParts {
  blocks: Record<string, NodeSpec>
  inlines: Record<string, NodeSpec>
  marks: Record<string, MarkSpec>
}

/** The schema for a set of extensions' blocks, inline nodes and marks. */
export function createSchema({ blocks, inlines, marks }: SchemaParts): Schema {
  const nodes: Record<string, NodeSpec> = { ...frame }
  for (const [name, spec] of Object.entries(blocks)) {
    if (name in nodes) throw new Error(`[@dou-ui/editor] "${name}" is a built-in node`)
    nodes[name] = { ...spec, group: spec.group ? `blockContent ${spec.group}` : 'blockContent' }
  }
  Object.assign(nodes, inlineFrame)
  for (const [name, spec] of Object.entries(inlines)) {
    if (name in nodes) throw new Error(`[@dou-ui/editor] "${name}" is a built-in node`)
    nodes[name] = { inline: true, ...spec, group: spec.group ? `inline ${spec.group}` : 'inline' }
  }
  return new Schema({ nodes, marks })
}

/** Links may only point to web pages, mail, phone numbers or relative paths. */
export function isSafeHref(href: string): boolean {
  // browsers ignore whitespace and control characters inside the scheme
  // eslint-disable-next-line no-control-regex
  const value = href.replace(/[\u0000- ]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase()
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme)
}

/** The content types that come with `starterKit`; extensions add more. */
export type BuiltinContentType =
  | 'paragraph'
  | 'heading'
  | 'bulletItem'
  | 'numberedItem'
  | 'checkItem'
  | 'quote'
  | 'codeBlock'
  | 'divider'
  | 'toggle'
  | 'callout'

export type ContentType = BuiltinContentType | (string & {})

export type BuiltinMarkType = 'bold' | 'italic' | 'underline' | 'strike' | 'code'

export type MarkType = BuiltinMarkType | (string & {})
