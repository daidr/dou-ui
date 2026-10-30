import { BoldIcon, CodeIcon, ItalicIcon, StrikethroughIcon, UnderlineIcon } from '@dou-ui/icons'
import { toggleMark } from 'prosemirror-commands'
import type { Command } from 'prosemirror-state'
import { defineExtension } from '../core/extension'
import { markInputRule } from '../core/input-rules'
import { isSafeHref } from '../core/schema'

/** Bold, italic, underline, strikethrough and inline code, with shortcuts and toolbar toggles. */
export const formatting = defineExtension({
  name: 'formatting',
  marks: {
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
  },
  output: {
    marks: {
      bold: { html: ['<strong>', '</strong>'], markdown: ['**', '**'] },
      italic: { html: ['<em>', '</em>'], markdown: ['*', '*'] },
      // Markdown has no underline; HTML is read back as one
      underline: { html: ['<u>', '</u>'], markdown: ['<u>', '</u>'] },
      strike: { html: ['<s>', '</s>'], markdown: ['~~', '~~'] },
      code: { html: ['<code>', '</code>'] },
    },
  },
  inputRules: () => [
    markInputRule(/(?:^|[^*])(\*\*([^*\s](?:[^*]*[^*\s])?)\*\*)$/, 'bold'),
    markInputRule(/(?:^|[^*])(\*([^*\s](?:[^*]*[^*\s])?)\*)$/, 'italic'),
    markInputRule(/(?:^|[^~])(~~([^~\s](?:[^~]*[^~\s])?)~~)$/, 'strike'),
    markInputRule(/(?:^|[^`])(`([^`\s](?:[^`]*[^`\s])?)`)$/, 'code'),
  ],
  keymap: ({ schema }) => {
    const toggle = (name: string): Command => toggleMark(schema.marks[name]!)
    return {
      'Mod-b': toggle('bold'),
      'Mod-i': toggle('italic'),
      'Mod-u': toggle('underline'),
      'Mod-Shift-s': toggle('strike'),
      'Mod-e': toggle('code'),
    }
  },
  formats: [
    { mark: 'bold', label: (m) => m.bold, icon: BoldIcon, hotkey: 'mod+b' },
    { mark: 'italic', label: (m) => m.italic, icon: ItalicIcon, hotkey: 'mod+i' },
    { mark: 'underline', label: (m) => m.underline, icon: UnderlineIcon, hotkey: 'mod+u' },
    { mark: 'strike', label: (m) => m.strike, icon: StrikethroughIcon, hotkey: 'mod+shift+s' },
    { mark: 'code', label: (m) => m.code, icon: CodeIcon, hotkey: 'mod+e' },
  ],
})

/**
 * Links. Only web pages, mail, phone numbers and relative paths are kept;
 * the formatting toolbar edits them, and `Mod+K` opens the editor for the
 * selected text.
 */
export const link = defineExtension({
  name: 'link',
  marks: {
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
  },
})
