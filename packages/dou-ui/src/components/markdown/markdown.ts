import type { VNode } from 'vue'
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
export interface MarkdownHr extends Span {
  type: 'hr'
}
export interface MarkdownBlockquote extends Span {
  type: 'blockquote'
  children: MarkdownBlock[]
}
/** A custom block: `:::name title`, its content, then `:::`. */
export interface MarkdownContainer extends Span {
  type: 'container'
  /** The word after the colons, e.g. `tip`. */
  name: string
  /** The rest of the opening line, trimmed. */
  title: string
  /** The closing fence has arrived. */
  closed: boolean
  children: MarkdownBlock[]
}
export interface MarkdownItem extends Span {
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
  children: MarkdownItem[]
}
export interface MarkdownRow extends Span {
  type: 'row'
  cells: MarkdownInline[][]
}
export interface MarkdownTable extends Span {
  type: 'table'
  align: MarkdownAlign[]
  head: MarkdownRow
  rows: MarkdownRow[]
}

export type MarkdownBlock =
  | MarkdownParagraph
  | MarkdownHeading
  | MarkdownCode
  | MarkdownHr
  | MarkdownBlockquote
  | MarkdownContainer
  | MarkdownList
  | MarkdownTable

/** Kinds of address `sanitizeUrl` is asked about. */
export type MarkdownUrlKind = 'link' | 'image' | 'source'

/** Where links open; any other string names a window or frame. */
export type MarkdownLinkTarget = '_blank' | '_self' | '_parent' | '_top' | (string & {})

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
  /**
   * Where links with a full address (`https://…`, `//…`) open. Relative
   * addresses and anchors always open in place.
   */
  linkTarget?: MarkdownLinkTarget
  /**
   * Checks the address of a link, image or citation source and returns the
   * one to use, or `undefined` to drop it (a link keeps its text, a source
   * its title). By default only http(s), mailto, tel, relative addresses and
   * anchors are kept: see `defaultSanitizeUrl`.
   */
  sanitizeUrl?: (url: string, kind: MarkdownUrlKind) => string | undefined
}

export interface MarkdownEmits {
  /** Everything is shown and `streaming` is off. */
  done: []
}

/**
 * Every slot replaces one kind of node. `children` is what would be drawn
 * inside it, new text still fading in; draw it with
 * `<component :is="children" />`.
 */
export interface MarkdownSlots {
  paragraph?: (props: { node: MarkdownParagraph; children: VNode }) => unknown
  heading?: (props: { node: MarkdownHeading; level: number; children: VNode }) => unknown
  blockquote?: (props: { node: MarkdownBlockquote; children: VNode }) => unknown
  list?: (props: { node: MarkdownList; children: VNode }) => unknown
  /** A list item; `children` leaves out the task checkbox. */
  item?: (props: { node: MarkdownItem; checked: boolean | null; children: VNode }) => unknown
  /** A table; `children` is the default `<table>`, e.g. to wrap it. */
  table?: (props: { node: MarkdownTable; children: VNode }) => unknown
  hr?: (props: { node: MarkdownHr }) => unknown
  /**
   * A fenced code block. `streaming` is on while its closing fence has not
   * arrived; hand it to CodeBlock so that only whole lines are highlighted.
   */
  code?: (props: MarkdownCodeSlotProps) => unknown
  /** A code block in one language, e.g. `code-mermaid`; before `code`. */
  [name: `code-${string}`]: ((props: MarkdownCodeSlotProps) => unknown) | undefined
  /** A `:::name` block. Without a slot, `tip`, `info`, `note`, `warning` and `danger` show as an Alert. */
  container?: (props: MarkdownContainerSlotProps) => unknown
  /** A container of one name, e.g. `container-tip`; before `container`. */
  [name: `container-${string}`]: ((props: MarkdownContainerSlotProps) => unknown) | undefined
  /**
   * A link. `href` has passed `sanitizeUrl`, and is missing while the
   * address is still being written or was dropped. `external` for a full
   * address, which opens at `linkTarget`.
   */
  link?: (props: {
    node: Extract<MarkdownInline, { type: 'link' }>
    href: string | undefined
    title: string | undefined
    external: boolean
    children: VNode
  }) => unknown
  /** An image whose address has passed `sanitizeUrl`. */
  image?: (props: { src: string; alt: string; title?: string }) => unknown
  /** A citation such as `[1]`, with the source from `sources` (its `url` checked). */
  citation?: (props: { index: number; source: ChatSource }) => unknown
  'inline-code'?: (props: { code: string }) => unknown
  strong?: (props: { children: VNode }) => unknown
  em?: (props: { children: VNode }) => unknown
  del?: (props: { children: VNode }) => unknown
}

export interface MarkdownCodeSlotProps {
  node: MarkdownCode
  code: string
  lang: string
  streaming: boolean
}

export interface MarkdownContainerSlotProps {
  node: MarkdownContainer
  name: string
  title: string
  /** Its closing fence has not arrived yet. */
  streaming: boolean
  children: VNode
}

export interface MarkdownExpose {
  /** Show everything received so far at once. */
  flush: () => void
}
