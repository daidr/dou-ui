import type { ResolvedEditorExtensions } from './extension'
import type { Block, InlineContent, MarkField, PartialBlock } from './model'
import { isAlign } from './align'
import { isSafeHref } from './schema'

/** What a block's writer gets besides the block. */
export interface BlockOutputContext {
  /** The block's text, already written in the output format. */
  content: string
  /** The block's text without formatting (e.g. for a code block). */
  text: string
  /** The child blocks, already written. */
  children: string
  /** The block's position, from 1, among the siblings of the same type right before it. */
  index: number
  /** Write other inline content (e.g. a table cell's) in the same format. */
  inline: (content: InlineContent[]) => string
}

export interface MarkdownBlockContext extends BlockOutputContext {
  /** The block's text as HTML, for Markdown that holds HTML (e.g. `<summary>`). */
  html: string
  /** Write other inline content as HTML. */
  inlineHTML: (content: InlineContent[]) => string
}

/** How a block type is written as HTML and Markdown. */
export interface BlockOutput {
  html?: (block: Block, context: BlockOutputContext) => string
  /**
   * Consecutive blocks with the same `group` sit in one element, written
   * as its opening tag (e.g. `ul`, `ol`); in Markdown they are kept
   * together without blank lines.
   */
  group?: string
  markdown?: (block: Block, context: MarkdownBlockContext) => string
}

/** How an inline node (e.g. a mention) is written. */
export interface InlineOutput {
  html?: (props: Record<string, unknown>) => string
  markdown?: (props: Record<string, unknown>) => string
}

/**
 * How a mark is written: the text between an opening and a closing string.
 * A mark with a value (a color) gives a function of the value.
 */
export type MarkTags = [open: string, close: string]

export interface MarkOutput {
  html?: MarkTags | ((value: string) => MarkTags)
  markdown?: MarkTags | ((value: string) => MarkTags)
}

/** What an extension contributes to `blocksToHTML` and `blocksToMarkdown`. */
export interface EditorExtensionOutput {
  blocks?: Record<string, BlockOutput>
  inlines?: Record<string, InlineOutput>
  marks?: Record<string, MarkOutput>
}

interface Outputs {
  blocks: Record<string, BlockOutput>
  inlines: Record<string, InlineOutput>
  marks: Record<string, MarkOutput>
  /** Marks stored as a field of the text run, by field: `color` → `textColor`. */
  fields: [field: MarkField, mark: string][]
}

const tagsOf = (tags: MarkOutput['html'] | undefined, value: string): MarkTags | undefined =>
  typeof tags === 'function' ? tags(value) : tags

function outputsOf(kit: ResolvedEditorExtensions): Outputs {
  const fields = Object.values(kit.schema.marks)
    .filter((type) => type.spec.field)
    .map((type) => [type.spec.field as MarkField, type.name] as [MarkField, string])
  const outputs: Outputs = { blocks: {}, inlines: {}, marks: {}, fields }
  // extensions that come first win, as with their keys
  for (let index = kit.extensions.length - 1; index >= 0; index--) {
    const extension = kit.extensions[index]!
    Object.assign(outputs.blocks, extension.output?.blocks)
    Object.assign(outputs.inlines, extension.output?.inlines)
    Object.assign(outputs.marks, extension.output?.marks)
  }
  return outputs
}

/** Fill in what a partial block leaves out, so writers always get a whole block. */
const toInline = (content: InlineContent[] | string): InlineContent[] =>
  typeof content === 'string' ? (content ? [{ type: 'text', text: content }] : []) : content

function complete(block: PartialBlock): Block {
  const result: Block = {
    id: block.id ?? '',
    type: block.type ?? 'paragraph',
    props: block.props ?? {},
    content: toInline(block.content ?? []),
    children: (block.children ?? []).map(complete),
  }
  if (block.rows)
    result.rows = block.rows.map((row) => ({
      id: row.id ?? '',
      cells: row.cells.map((cell) =>
        typeof cell === 'string'
          ? { content: toInline(cell) }
          : { ...cell, content: toInline(cell.content ?? []) },
      ),
    }))
  return result
}

/* HTML */

export const escapeHTML = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const plainText = (content: InlineContent[]) =>
  content
    .map((item) => (item.type === 'text' ? item.text : item.type === 'break' ? '\n' : ''))
    .join('')

function inlineHTML(content: InlineContent[], outputs: Outputs): string {
  let result = ''
  for (const item of content) {
    if (item.type === 'break') result += '<br>'
    else if (item.type === 'inline') result += outputs.inlines[item.name]?.html?.(item.props) ?? ''
    else {
      let text = escapeHTML(item.text)
      const marks = item.marks ?? []
      for (let index = marks.length - 1; index >= 0; index--) {
        const tags = tagsOf(outputs.marks[marks[index]!]?.html, '')
        if (tags) text = tags[0] + text + tags[1]
      }
      // highlight inside the color, both inside a link
      for (let index = outputs.fields.length - 1; index >= 0; index--) {
        const [field, mark] = outputs.fields[index]!
        const value = item[field]
        const tags = value && tagsOf(outputs.marks[mark]?.html, value)
        if (tags) text = tags[0] + text + tags[1]
      }
      if (item.link && isSafeHref(item.link))
        text = `<a href="${escapeHTML(item.link)}">${text}</a>`
      result += text
    }
  }
  return result
}

const closingTag = (group: string) => `</${group.split(/\s/)[0]}>`

/** An aligned block's first element gets `style="text-align: …"`. */
function withAlign(html: string, align: unknown): string {
  if (!isAlign(align)) return html
  return html.replace(/^<([a-z][a-z0-9]*)/i, `<$1 style="text-align: ${align}"`)
}

/** Top-level blocks go on lines of their own, so the HTML stays readable. */
function blocksHTML(blocks: Block[], outputs: Outputs, top = false): string {
  const newline = top ? '\n' : ''
  let result = ''
  let group: string | undefined
  let index = 0
  blocks.forEach((block, position) => {
    const output = outputs.blocks[block.type]
    index = position > 0 && blocks[position - 1]!.type === block.type ? index + 1 : 1
    if (output?.group !== group) {
      if (group) result += newline + closingTag(group)
      group = output?.group
      if (group) result += (result ? newline : '') + `<${group}>`
    }
    if (result) result += newline
    const context: BlockOutputContext = {
      content: inlineHTML(block.content, outputs),
      text: plainText(block.content),
      children: blocksHTML(block.children, outputs),
      index,
      inline: (content) => inlineHTML(content, outputs),
    }
    const html = output?.html
      ? output.html(block, context)
      : `<p>${context.content}</p>${context.children}`
    result += withAlign(html, block.props.align)
  })
  if (group) result += newline + closingTag(group)
  return result
}

/**
 * Write blocks as HTML, e.g. to show a document outside the editor or to
 * send it by email. Each extension decides how its blocks look; the
 * result has no editor classes.
 */
export function writeHTML(blocks: PartialBlock[], kit: ResolvedEditorExtensions): string {
  return blocksHTML(blocks.map(complete), outputsOf(kit), true)
}

/* Markdown */

/** Characters that mean something anywhere in Markdown text. */
const SPECIAL = /[\\`*_[\]<>~|]|&(?=#?\w+;)/g

/** What would start a block at the beginning of a line. */
const LINE_START = /^(\s*)(#{1,6}(?=\s|$)|[-+](?=\s|$)|-+(?=\s*$)|=+(?=\s*$)|(\d+)([.)])(?=\s|$))/

function escapeLine(text: string): string {
  return text.replace(
    LINE_START,
    (_all, space: string, mark: string, digits?: string, dot?: string) =>
      digits ? `${space}${digits}\\${dot}` : `${space}\\${mark}`,
  )
}

export const escapeMarkdown = (text: string) => text.replace(SPECIAL, '\\$&')

const PUNCTUATION = /[\p{P}\p{S}]/u
const SPACE = /\s/u

/**
 * Whether a delimiter such as `**` can open (or close) emphasis here: the
 * text inside must not start (end) with a space, and when it starts (ends)
 * with punctuation, the outside must be a space, punctuation or the edge.
 * Otherwise the HTML tag is written, which Markdown reads as well.
 */
function flanks(inner: string | undefined, outer: string | undefined) {
  if (!inner || SPACE.test(inner)) return false
  if (!PUNCTUATION.test(inner)) return true
  return !outer || SPACE.test(outer) || PUNCTUATION.test(outer)
}

function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(longest + 1)
  const pad =
    /^`|`$/.test(text) || (text.startsWith(' ') && text.endsWith(' ') && text.trim()) ? ' ' : ''
  return fence + pad + text + pad + fence
}

/** A key for each formatting a run has, outermost first: the link, then the marks. */
function keysOf(item: InlineContent, outputs: Outputs): string[] {
  if (item.type !== 'text') return []
  const keys: string[] = []
  if (item.link && isSafeHref(item.link)) keys.push(`link:${item.link}`)
  for (const [field, mark] of outputs.fields) {
    const value = item[field]
    if (value && hasOutput(mark, outputs)) keys.push(`${mark}=${value}`)
  }
  for (const mark of item.marks ?? [])
    if (mark !== 'code' && hasOutput(mark, outputs)) keys.push(mark)
  return keys
}

const hasOutput = (mark: string, outputs: Outputs) =>
  !!(outputs.marks[mark]?.markdown ?? outputs.marks[mark]?.html)

function linkDestination(href: string) {
  return /[\s()<>]/.test(href) ? `<${href.replace(/[<>]/g, encodeURIComponent)}>` : href
}

const textOf = (item: InlineContent | undefined) =>
  item?.type === 'text' ? item.text : item?.type === 'inline' ? '@' : item ? '\n' : ''

function inlineMarkdown(content: InlineContent[], outputs: Outputs): string {
  let result = ''
  const stack: { key: string; close: string }[] = []

  /** The text a mark will cover from `start`, and the character after it. */
  function span(start: number, key: string) {
    let text = ''
    let end = start
    while (end < content.length && keysOf(content[end]!, outputs).includes(key)) {
      text += textOf(content[end])
      end++
    }
    return { text: text.trim(), after: textOf(content[end])[0] }
  }

  function open(key: string, start: number) {
    if (key.startsWith('link:')) {
      stack.push({ key, close: `](${linkDestination(key.slice(5))})` })
      result += '['
      return
    }
    const [name, value = ''] = key.split('=') as [string, string?]
    const tags = {
      markdown: tagsOf(outputs.marks[name]!.markdown, value),
      html: tagsOf(outputs.marks[name]!.html, value),
    }
    const { text, after } = span(start, key)
    const delimiter = tags.markdown
    const usable =
      delimiter && flanks(text[0], result.at(-1)) && flanks(text.at(-1), after ?? undefined)
    const [opening, closing] = usable ? delimiter : (tags.html ?? delimiter!)
    result += opening
    stack.push({ key, close: closing })
  }

  content.forEach((item, index) => {
    const keys = keysOf(item, outputs)
    let keep = 0
    while (keep < stack.length && keys.includes(stack[keep]!.key)) keep++
    // spaces at the edges of formatted text go outside the delimiters
    let text = item.type === 'text' ? item.text : ''
    const lead = keys.length > keep ? (/^\s+/.exec(text)?.[0] ?? '') : ''
    while (stack.length > keep) result += stack.pop()!.close
    result += lead
    text = text.slice(lead.length)
    for (const key of keys) if (!stack.some((entry) => entry.key === key)) open(key, index)

    if (item.type === 'break') {
      result += '\\\n'
      return
    }
    if (item.type === 'inline') {
      result += outputs.inlines[item.name]?.markdown?.(item.props) ?? ''
      return
    }
    const nextKeys = keysOf(content[index + 1] ?? { type: 'break' }, outputs)
    const closes = stack.some((entry) => !nextKeys.includes(entry.key))
    const trail = closes ? (/\s+$/.exec(text)?.[0] ?? '') : ''
    if (trail) text = text.slice(0, -trail.length)
    let written = item.marks?.includes('code') ? codeSpan(text) : escapeMarkdown(text)
    if (!item.marks?.includes('code')) written = written.split('\n').map(escapeLine).join('\n')
    result += written
    if (trail) {
      // close what ends here before the spaces; the next run closes nothing more
      const stay = stack.findIndex((entry) => !nextKeys.includes(entry.key))
      while (stack.length > stay) result += stack.pop()!.close
      result += trail
    }
  })
  while (stack.length) result += stack.pop()!.close
  return result
}

/** Put `prefix` before every line, and `rest` (default: as many spaces) before the ones after the first. */
export function indentLines(
  text: string,
  prefix: string,
  rest = ' '.repeat(prefix.length),
): string {
  return text
    .split('\n')
    .map((line, index) => (index === 0 ? prefix + line : line ? rest + line : rest.trimEnd()))
    .join('\n')
}

function blocksMarkdown(blocks: Block[], outputs: Outputs): string {
  let result = ''
  let index = 0
  blocks.forEach((block, position) => {
    const output = outputs.blocks[block.type]
    const previous = blocks[position - 1]
    index = previous?.type === block.type ? index + 1 : 1
    const context: MarkdownBlockContext = {
      content: inlineMarkdown(block.content, outputs),
      html: inlineHTML(block.content, outputs),
      text: plainText(block.content),
      children: blocksMarkdown(block.children, outputs),
      index,
      inline: (content) => inlineMarkdown(content, outputs),
      inlineHTML: (content) => inlineHTML(content, outputs),
    }
    const written = output?.markdown
      ? output.markdown(block, context)
      : [context.content, context.children].filter(Boolean).join('\n\n')
    if (!written) return
    if (result) {
      const tight =
        previous && output?.group && outputs.blocks[previous.type]?.group === output.group
      result += tight ? '\n' : '\n\n'
    }
    result += written
  })
  return result
}

/** Write blocks as Markdown (CommonMark with GitHub's extensions). */
export function writeMarkdown(blocks: PartialBlock[], kit: ResolvedEditorExtensions): string {
  const markdown = blocksMarkdown(blocks.map(complete), outputsOf(kit))
  return markdown ? `${markdown}\n` : ''
}
