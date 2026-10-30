import type { Mark, NodeType, Node as PMNode, Schema } from 'prosemirror-model'
import type { ContentType, MarkType } from './schema'

/** A run of text with its formatting. */
export interface TextContent {
  type: 'text'
  text: string
  /** Formatting, in a fixed order: bold, italic, underline, strike, code. */
  marks?: MarkType[]
  /** The link target, when the text is a link. */
  link?: string
}

/** A line break inside a block (`Shift+Enter`). */
export interface BreakContent {
  type: 'break'
}

/** An inline node an extension adds, e.g. a mention. */
export interface InlineNodeContent {
  type: 'inline'
  /** The node's name, e.g. `mention`. */
  name: string
  props: Record<string, unknown>
}

export type InlineContent = TextContent | BreakContent | InlineNodeContent

/** A block's attributes: those of the built-in types, and any an extension declares. */
export interface BlockProps {
  /** Heading level, `1` to `3`. */
  level?: number
  /** Whether a to-do item is done. */
  checked?: boolean
  /** The language of a code block. */
  language?: string
  /** The tone of a callout: `info`, `tip`, `warning` or `danger`. */
  tone?: string
  [name: string]: unknown
}

/** One block of the document, as `v-model` reads and writes it. */
export interface Block {
  /** Stable across edits; a random UUID unless you provide your own. */
  id: string
  type: ContentType
  props: BlockProps
  content: InlineContent[]
  children: Block[]
}

/** A block to insert: everything but the type is optional. */
export interface PartialBlock {
  id?: string
  type?: ContentType
  props?: BlockProps
  /** Inline content, or plain text. */
  content?: InlineContent[] | string
  children?: PartialBlock[]
}

const MARK_ORDER: string[] = ['bold', 'italic', 'underline', 'strike', 'code']

/** Built-in marks in a fixed order, then the others by name. */
const markRank = (name: string) => {
  const index = MARK_ORDER.indexOf(name)
  return index < 0 ? MARK_ORDER.length : index
}

/** A random id; UUIDs keep blocks created at the same time on two devices apart. */
export function createId(): string {
  const crypto = globalThis.crypto
  if (crypto?.randomUUID) return crypto.randomUUID()
  // a v4 UUID from `getRandomValues`, or `Math.random` as a last resort
  const bytes = new Uint8Array(16)
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/* document → blocks */

function inlineOf(node: PMNode): InlineContent[] {
  const result: InlineContent[] = []
  node.forEach((child) => {
    if (child.type.name === 'hardBreak') {
      result.push({ type: 'break' })
      return
    }
    if (!child.isText) {
      result.push({ type: 'inline', name: child.type.name, props: { ...child.attrs } })
      return
    }
    const marks = child.marks
      .map((mark) => mark.type.name)
      .filter((name): name is MarkType => name !== 'link')
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts the filtered copy
      .sort((a, b) => markRank(a) - markRank(b) || a.localeCompare(b))
    const link = child.marks.find((mark) => mark.type.name === 'link')?.attrs.href as
      string | undefined
    const item: TextContent = { type: 'text', text: child.text ?? '' }
    if (marks.length) item.marks = marks
    if (link) item.link = link
    // merge with the previous run when the formatting is the same
    const previous = result.at(-1)
    if (
      previous?.type === 'text' &&
      previous.link === item.link &&
      String(previous.marks ?? '') === String(item.marks ?? '')
    )
      previous.text += item.text
    else result.push(item)
  })
  return result
}

const propsOf = (content: PMNode): BlockProps => ({ ...content.attrs })

export function blockFromNode(node: PMNode): Block {
  const content = node.firstChild!
  const group = node.childCount > 1 ? node.child(1) : null
  const children: Block[] = []
  group?.forEach((child) => children.push(blockFromNode(child)))
  return {
    id: node.attrs.id as string,
    type: content.type.name as ContentType,
    props: propsOf(content),
    content: content.type.spec.code ? codeText(content) : inlineOf(content),
    children,
  }
}

function codeText(node: PMNode): InlineContent[] {
  return node.textContent ? [{ type: 'text', text: node.textContent }] : []
}

export function docToBlocks(doc: PMNode): Block[] {
  const blocks: Block[] = []
  doc.forEach((node) => blocks.push(blockFromNode(node)))
  return blocks
}

/* blocks → document */

function marksFor(schema: Schema, item: TextContent): Mark[] {
  const marks: Mark[] = []
  for (const name of item.marks ?? []) {
    const type = schema.marks[name]
    if (type) marks.push(type.create())
  }
  if (item.link && schema.marks.link) marks.push(schema.marks.link.create({ href: item.link }))
  return marks
}

function inlineNodes(schema: Schema, content: PartialBlock['content'], code: boolean): PMNode[] {
  if (content === undefined) return []
  const items: InlineContent[] =
    typeof content === 'string' ? [{ type: 'text', text: content }] : content
  const nodes: PMNode[] = []
  for (const item of items) {
    if (item.type === 'break') {
      nodes.push(code ? schema.text('\n') : schema.nodes.hardBreak!.create())
    } else if (item.type === 'inline') {
      // an inline node whose extension is missing is left out
      const type = schema.nodes[item.name]
      if (type?.isInline && !code) nodes.push(type.create(item.props))
    } else if (item.text) {
      nodes.push(schema.text(item.text, code ? [] : marksFor(schema, item)))
    }
  }
  return nodes
}

/**
 * The attributes a content type declares, taken from `props` where given.
 * A spec's `normalizeProps` can clamp them, e.g. a heading's level.
 */
function contentAttrs(type: NodeType, props: BlockProps = {}) {
  const attrs: Record<string, unknown> = {}
  for (const name of Object.keys(type.spec.attrs ?? {})) {
    if (props[name] !== undefined) attrs[name] = props[name]
  }
  const normalize = type.spec.normalizeProps as
    ((attrs: Record<string, unknown>) => Record<string, unknown>) | undefined
  return normalize ? normalize(attrs) : attrs
}

export function createContentNode(
  schema: Schema,
  type: ContentType,
  props?: BlockProps,
  content?: PartialBlock['content'],
): PMNode {
  const nodeType = schema.nodes[type]?.isInGroup('blockContent')
    ? schema.nodes[type]!
    : schema.nodes.paragraph!
  const attrs = contentAttrs(nodeType, props)
  if (nodeType.isAtom || !nodeType.inlineContent) return nodeType.create(attrs)
  return nodeType.create(attrs, inlineNodes(schema, content, !!nodeType.spec.code))
}

export function nodeFromBlock(schema: Schema, block: PartialBlock): PMNode {
  const content = createContentNode(schema, block.type ?? 'paragraph', block.props, block.content)
  const children = (block.children ?? []).map((child) => nodeFromBlock(schema, child))
  const parts = children.length
    ? [content, schema.nodes.blockGroup!.create(null, children)]
    : [content]
  return schema.nodes.block!.create({ id: block.id ?? createId() }, parts)
}

export function blocksToDoc(schema: Schema, blocks: PartialBlock[]): PMNode {
  const list = blocks.length ? blocks : [{ type: 'paragraph' as const }]
  return schema.nodes.doc!.create(
    null,
    list.map((block) => nodeFromBlock(schema, block)),
  )
}
