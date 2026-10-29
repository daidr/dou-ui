import {
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
} from '@dou-ui/icons'
import type { Component } from 'vue'
import type { BlockProps } from './core/model'
import type { ContentType } from './core/schema'
import type { EditorMessages } from './locale'

/** A block type as menus list it. */
export interface BlockOption {
  /** The key into the messages' `types` and `hints`. */
  key: keyof EditorMessages['types']
  type: ContentType
  props?: BlockProps
  icon: Component
  /** Extra words the slash menu matches, besides the label. */
  keywords: string[]
  /** The Markdown shortcut, shown as a hint. */
  shortcut?: string
}

export const blockOptions: BlockOption[] = [
  {
    key: 'paragraph',
    type: 'paragraph',
    icon: PilcrowIcon,
    keywords: ['text', 'p', 'zw', 'wenben'],
  },
  {
    key: 'heading1',
    type: 'heading',
    props: { level: 1 },
    icon: Heading1Icon,
    keywords: ['h1', 'heading', 'title', 'bt', 'biaoti'],
    shortcut: '#',
  },
  {
    key: 'heading2',
    type: 'heading',
    props: { level: 2 },
    icon: Heading2Icon,
    keywords: ['h2', 'heading', 'subtitle', 'bt', 'biaoti'],
    shortcut: '##',
  },
  {
    key: 'heading3',
    type: 'heading',
    props: { level: 3 },
    icon: Heading3Icon,
    keywords: ['h3', 'heading', 'bt', 'biaoti'],
    shortcut: '###',
  },
  {
    key: 'bulletItem',
    type: 'bulletItem',
    icon: ListIcon,
    keywords: ['ul', 'bullet', 'list', 'lb', 'liebiao'],
    shortcut: '-',
  },
  {
    key: 'numberedItem',
    type: 'numberedItem',
    icon: ListOrderedIcon,
    keywords: ['ol', 'number', 'ordered', 'list', 'lb', 'bianhao'],
    shortcut: '1.',
  },
  {
    key: 'checkItem',
    type: 'checkItem',
    icon: ListTodoIcon,
    keywords: ['todo', 'task', 'check', 'db', 'daiban', 'renwu'],
    shortcut: '[]',
  },
  {
    key: 'quote',
    type: 'quote',
    icon: QuoteIcon,
    keywords: ['quote', 'blockquote', 'yy', 'yinyong'],
    shortcut: '>',
  },
  {
    key: 'codeBlock',
    type: 'codeBlock',
    icon: CodeIcon,
    keywords: ['code', 'pre', 'dm', 'daima'],
    shortcut: '```',
  },
  {
    key: 'divider',
    type: 'divider',
    icon: MinusIcon,
    keywords: ['hr', 'divider', 'line', 'fgx', 'fengexian'],
    shortcut: '---',
  },
]

/** Options whose label, key or keywords contain the query (case-insensitive). */
export function filterOptions(options: BlockOption[], query: string, messages: EditorMessages) {
  const needle = query.trim().toLowerCase()
  if (!needle) return options
  return options.filter((option) => {
    const label = messages.types[option.key].toLowerCase()
    return (
      label.includes(needle) ||
      option.key.toLowerCase().includes(needle) ||
      option.keywords.some((word) => word.startsWith(needle))
    )
  })
}

/** Whether an option describes the block as it is now. */
export function isCurrent(option: BlockOption, type: string, props: BlockProps): boolean {
  if (option.type !== type) return false
  return option.type !== 'heading' || option.props?.level === props.level
}
