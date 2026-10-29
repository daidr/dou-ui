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
 * Every piece of state lives in node attributes (never in a node view),
 * so a collaborative binding can sync it like any other change.
 */

const block = (type: string, extra: Record<string, string> = {}): DOMOutputSpec => [
  'div',
  {
    class: `dou-editor__content dou-editor__content--${type}`,
    'data-content-type': type,
    ...extra,
  },
  0,
]

const textBlock = (type: string, spec: Partial<NodeSpec> = {}): NodeSpec => ({
  group: 'blockContent',
  content: 'inline*',
  defining: true,
  parseDOM: [{ tag: `div[data-content-type="${type}"]` }],
  toDOM: () => block(type),
  ...spec,
})

export const nodes: Record<string, NodeSpec> = {
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
    parseDOM: [{ tag: 'div[data-content-type="paragraph"]' }, { tag: 'p' }],
  }),

  heading: textBlock('heading', {
    attrs: { level: { default: 1 } },
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
      tag: `h${level}`,
      attrs: { level: Math.min(level, 3) },
    })),
    toDOM: (node) => [
      `h${node.attrs.level}`,
      { class: 'dou-editor__content dou-editor__content--heading', 'data-content-type': 'heading' },
      0,
    ],
  }),

  bulletItem: textBlock('bulletItem', {
    parseDOM: [{ tag: 'div[data-content-type="bulletItem"]' }, { tag: 'ul > li' }],
  }),
  numberedItem: textBlock('numberedItem', {
    parseDOM: [{ tag: 'div[data-content-type="numberedItem"]' }, { tag: 'ol > li' }],
  }),

  checkItem: textBlock('checkItem', {
    attrs: { checked: { default: false } },
    parseDOM: [
      {
        tag: 'div[data-content-type="checkItem"]',
        getAttrs: (dom) => ({ checked: (dom as HTMLElement).dataset.checked === 'true' }),
      },
    ],
    toDOM: (node) => block('checkItem', { 'data-checked': String(node.attrs.checked) }),
  }),

  quote: textBlock('quote', {
    parseDOM: [{ tag: 'div[data-content-type="quote"]' }, { tag: 'blockquote' }],
    toDOM: () => [
      'blockquote',
      { class: 'dou-editor__content dou-editor__content--quote', 'data-content-type': 'quote' },
      0,
    ],
  }),

  codeBlock: {
    group: 'blockContent',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    attrs: { language: { default: '' } },
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => ({ language: (dom as HTMLElement).dataset.language ?? '' }),
      },
    ],
    toDOM: (node) => [
      'pre',
      {
        class: 'dou-editor__content dou-editor__content--codeBlock',
        'data-content-type': 'codeBlock',
        'data-language': node.attrs.language,
        spellcheck: 'false',
      },
      ['code', 0],
    ],
  },

  divider: {
    group: 'blockContent',
    atom: true,
    selectable: true,
    parseDOM: [{ tag: 'hr' }],
    toDOM: () => [
      'div',
      { class: 'dou-editor__content dou-editor__content--divider', 'data-content-type': 'divider' },
      ['hr'],
    ],
  },

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

export const marks: Record<string, MarkSpec> = {
  bold: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (dom) => (dom as HTMLElement).style.fontWeight !== 'normal' && null },
      {
        style: 'font-weight',
        getAttrs: (value) => /^(bold(er)?|[6-9]\d{2})$/.test(value as string) && null,
      },
    ],
    toDOM: () => ['strong', 0],
  },
  italic: {
    parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
    toDOM: () => ['em', 0],
  },
  underline: {
    parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
    toDOM: () => ['u', 0],
  },
  strike: {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
    toDOM: () => ['s', 0],
  },
  code: {
    excludes: '_',
    parseDOM: [{ tag: 'code' }],
    toDOM: () => ['code', { class: 'dou-editor__inline-code' }, 0],
  },
  link: {
    attrs: { href: {} },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom) => {
          const href = (dom as HTMLElement).getAttribute('href') ?? ''
          return isSafeHref(href) ? { href } : false
        },
      },
    ],
    toDOM: (mark) => [
      'a',
      {
        href: isSafeHref(mark.attrs.href as string) ? mark.attrs.href : null,
        rel: 'noopener noreferrer nofollow',
        class: 'dou-editor__link',
      },
      0,
    ],
  },
}

/** Links may only point to web pages, mail, phone numbers or relative paths. */
export function isSafeHref(href: string): boolean {
  // browsers ignore whitespace and control characters inside the scheme
  // eslint-disable-next-line no-control-regex
  const value = href.replace(/[\u0000-\u0020]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase()
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme)
}

export const schema = new Schema({ nodes, marks })

export type ContentType =
  | 'paragraph'
  | 'heading'
  | 'bulletItem'
  | 'numberedItem'
  | 'checkItem'
  | 'quote'
  | 'codeBlock'
  | 'divider'

export type MarkType = 'bold' | 'italic' | 'underline' | 'strike' | 'code'
