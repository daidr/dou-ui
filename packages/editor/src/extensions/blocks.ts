import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
} from '@dou-ui/icons'
import { setBlockType } from '../core/commands'
import { defineEditorExtension } from '../core/extension'
import { atomInputRule, blockInputRule } from '../core/input-rules'
import { indentLines } from '../core/output'
import { blockElement, splitContainer } from '../core/prepare'
import { textBlock } from '../core/schema'

/** The paragraph itself is part of the frame; this adds its menu entry and shortcut. */
export const paragraph = defineEditorExtension({
  name: 'paragraph',
  blockOptions: [
    {
      key: 'paragraph',
      type: 'paragraph',
      label: (m) => m.types.paragraph,
      hint: (m) => m.hints.paragraph,
      icon: PilcrowIcon,
      keywords: ['text', 'p', 'zw', 'zhengwen', 'wenben'],
    },
  ],
})

const LEVELS = [1, 2, 3] as const
const levelOf = (level: unknown) => Math.min(3, Math.max(1, Number(level) || 1))
const headingIcons = { 1: Heading1Icon, 2: Heading2Icon, 3: Heading3Icon }

/** Headings, levels 1 to 3. `# ` to `### ` turn a paragraph into one. */
export const heading = defineEditorExtension({
  name: 'heading',
  blocks: {
    heading: textBlock('heading', {
      attrs: { level: { default: 1 } },
      normalizeProps: (attrs: { level?: number }) =>
        attrs.level === undefined
          ? attrs
          : { ...attrs, level: Math.min(3, Math.max(1, attrs.level)) },
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
        tag: `h${level}`,
        attrs: { level: Math.min(level, 3) },
      })),
      toDOM: (node) => [
        `h${node.attrs.level}`,
        {
          class: 'dou-editor__content dou-editor__content--heading',
          'data-content-type': 'heading',
        },
        0,
      ],
    }),
  },
  output: {
    blocks: {
      heading: {
        html: (block, { content, children }) =>
          `<h${levelOf(block.props.level)}>${content}</h${levelOf(block.props.level)}>${children}`,
        markdown: (block, { content, children }) =>
          [`${'#'.repeat(levelOf(block.props.level))} ${content}`.trimEnd(), children]
            .filter(Boolean)
            .join('\n\n'),
      },
    },
  },
  inputRules: () => [
    blockInputRule(/^(#{1,3})\s$/, 'heading', (match) => ({ level: match[1]!.length })),
  ],
  keymap: () =>
    Object.fromEntries(
      LEVELS.map((level) => [`mod+alt+${level}`, setBlockType('heading', { level })]),
    ),
  blockOptions: LEVELS.map((level) => ({
    key: `heading${level}`,
    type: 'heading',
    props: { level },
    label: (m) => m.types[`heading${level}`],
    hint: (m) => m.hints[`heading${level}`],
    icon: headingIcons[level],
    keywords: [`h${level}`, 'heading', 'title', 'bt', 'biaoti'],
    shortcut: '#'.repeat(level),
  })),
})

/** A quotation. `> ` turns a paragraph into one. */
export const quote = defineEditorExtension({
  name: 'quote',
  blocks: {
    quote: textBlock('quote', {
      parseDOM: [{ tag: 'div[data-content-type="quote"]' }, { tag: 'blockquote' }],
      toDOM: () => [
        'blockquote',
        { class: 'dou-editor__content dou-editor__content--quote', 'data-content-type': 'quote' },
        0,
      ],
    }),
  },
  output: {
    blocks: {
      quote: {
        html: (_block, { content, children }) =>
          `<blockquote><p>${content}</p>${children}</blockquote>`,
        markdown: (_block, { content, children }) =>
          indentLines([content, children].filter(Boolean).join('\n\n'), '> ', '> '),
      },
    },
  },
  // a quote holds its first paragraph; what follows becomes its children
  prepareHTML: (root) => {
    for (const element of Array.from(root.querySelectorAll('blockquote'))) {
      const { content, children } = splitContainer(element)
      element.replaceWith(blockElement(element.ownerDocument, 'quote', content, children))
    }
  },
  inputRules: () => [blockInputRule(/^>\s$/, 'quote')],
  blockOptions: [
    {
      key: 'quote',
      type: 'quote',
      label: (m) => m.types.quote,
      hint: (m) => m.hints.quote,
      icon: QuoteIcon,
      keywords: ['quote', 'blockquote', 'yy', 'yinyong'],
      shortcut: '>',
    },
  ],
})

/** A horizontal line. `---` in an empty paragraph. */
export const divider = defineEditorExtension({
  name: 'divider',
  blocks: {
    divider: {
      atom: true,
      selectable: true,
      parseDOM: [{ tag: 'hr' }],
      toDOM: () => [
        'div',
        {
          class: 'dou-editor__content dou-editor__content--divider',
          'data-content-type': 'divider',
        },
        ['hr'],
      ],
    },
  },
  output: {
    blocks: {
      divider: { html: () => '<hr>', markdown: () => '---' },
    },
  },
  inputRules: () => [atomInputRule(/^(?:---|___|\*\*\*)$/, 'divider')],
  blockOptions: [
    {
      key: 'divider',
      type: 'divider',
      label: (m) => m.types.divider,
      hint: (m) => m.hints.divider,
      icon: MinusIcon,
      keywords: ['hr', 'divider', 'line', 'fgx', 'fengexian'],
      shortcut: '---',
    },
  ],
})
