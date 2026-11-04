import type { ChatSource } from '../chat-sources/chat-sources'

/** Column alignment of a table, from its delimiter row. */
export type MarkdownAlign = 'left' | 'center' | 'right' | ''

/** Inline content: what a paragraph, heading or table cell is made of. */
export type MarkdownInline =
  /** `at` is where the text starts in the source, which the reveal animation goes by. */
  | { type: 'text'; value: string; at: number }
  | { type: 'strong' | 'em' | 'del'; children: MarkdownInline[] }
  | { type: 'code'; value: string; at: number }
  /** `href` is missing while the address is still being written. */
  | { type: 'link'; href?: string; title?: string; children: MarkdownInline[] }
  | { type: 'image'; src: string; alt: string; title?: string }
  /** A hard line break. */
  | { type: 'break' }
  /** A line break inside a paragraph; `cjk` when both sides are CJK, so no space shows. */
  | { type: 'softbreak'; cjk?: boolean }

interface Span {
  /** Where the block starts in the source, in UTF-16 units. Also its key. */
  start: number
  /** Where it ends. */
  end: number
}

export interface MarkdownParagraph extends Span {
  type: 'paragraph'
  children: MarkdownInline[]
}
export interface MarkdownHeading extends Span {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: MarkdownInline[]
}
export interface MarkdownCode extends Span {
  type: 'code'
  /** The first word of the info string, e.g. `ts`. */
  lang: string
  value: string
  /** The closing fence has arrived (always true for indented code). */
  closed: boolean
}
export interface MarkdownRule extends Span {
  type: 'hr'
}
export interface MarkdownQuote extends Span {
  type: 'blockquote'
  children: MarkdownBlock[]
}
export interface MarkdownListItem extends Span {
  type: 'item'
  /** `true` / `false` for a task item, `null` otherwise. */
  checked: boolean | null
  /** Copied from the list: a tight list shows its paragraphs without spacing. */
  tight: boolean
  children: MarkdownBlock[]
}
export interface MarkdownList extends Span {
  type: 'list'
  ordered: boolean
  /** The number of the first item of an ordered list. */
  startNumber: number
  tight: boolean
  children: MarkdownListItem[]
}
export interface MarkdownTableRow extends Span {
  type: 'row'
  cells: MarkdownInline[][]
}
export interface MarkdownTable extends Span {
  type: 'table'
  align: MarkdownAlign[]
  head: MarkdownTableRow
  rows: MarkdownTableRow[]
}

export type MarkdownBlock =
  | MarkdownParagraph
  | MarkdownHeading
  | MarkdownCode
  | MarkdownRule
  | MarkdownQuote
  | MarkdownList
  | MarkdownTable

/** Kinds of address `sanitizeUrl` is asked about. */
export type MarkdownUrlKind = 'link' | 'image'

export interface MarkdownProps {
  /** The Markdown source. While streaming, everything received so far. */
  content?: string
  /** More is still coming: unfinished syntax at the end is shown in its likely final form. */
  streaming?: boolean
  /**
   * Reveal new content gradually and fade it in. Turned off, it shows as it
   * arrives, still at most once a frame. Content that is already there when
   * the component mounts is shown at once either way.
   */
  smooth?: boolean
  /** The slowest reveal, in characters per second. A larger backlog is caught up faster. */
  speed?: number
  /** Show a blinking caret after the last character while streaming. */
  caret?: boolean
  /** Sources for citations: `[1]` in the text shows as a ChatCitation for the first one. */
  sources?: ChatSource[]
  /** Where links open. */
  linkTarget?: string
  /**
   * Checks the address of a link or image and returns the one to use, or
   * `undefined` to drop it (a link keeps its text). By default only http(s),
   * mailto, tel, relative addresses and anchors are kept.
   */
  sanitizeUrl?: (url: string, kind: MarkdownUrlKind) => string | undefined
}

export interface MarkdownEmits {
  /** Everything is shown and `streaming` is off. */
  done: []
}

export interface MarkdownSlots {
  /** Replaces a fenced code block, e.g. to draw `mermaid` as a chart. */
  code?: (props: { code: string; lang: string; streaming: boolean }) => unknown
  /** Replaces an image, e.g. to add a preview. */
  image?: (props: { src: string; alt: string; title?: string }) => unknown
}

export interface MarkdownExpose {
  /** Show everything received so far at once. */
  flush: () => void
}
