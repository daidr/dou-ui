import MarkdownIt from 'markdown-it'
import { kitOf, type EditorExtensionList } from '../core/convert'
import type { Block, PartialBlock } from '../core/model'
import { writeMarkdown } from '../core/output'
import { parseHTML } from '../core/prepare'

export interface MarkdownToBlocksOptions {
  /**
   * Turns Markdown into HTML. Defaults to markdown-it with HTML allowed
   * (the HTML is read like pasted HTML, so only what the extensions know
   * is kept); pass your own to add syntax.
   */
  render?: (markdown: string) => string
}

let parser: MarkdownIt | undefined

function render(markdown: string) {
  parser ??= new MarkdownIt({ html: true, linkify: true })
  return parser.render(markdown)
}

/** Write blocks as Markdown (CommonMark with GitHub's extensions). Works without a browser. */
export function blocksToMarkdown(blocks: PartialBlock[], extensions: EditorExtensionList): string {
  return writeMarkdown(blocks, kitOf(extensions))
}

/** Read Markdown as blocks. Needs `DOMParser` (a browser, or a DOM library). */
export function markdownToBlocks(
  markdown: string,
  extensions: EditorExtensionList,
  options: MarkdownToBlocksOptions = {},
): Block[] {
  return parseHTML((options.render ?? render)(markdown), kitOf(extensions))
}
