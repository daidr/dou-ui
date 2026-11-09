import MarkdownIt from 'markdown-it'
import { kitOf, type EditorExtensionList } from '../core/convert'
import type { Block, PartialBlock } from '../core/model'
import { writeMarkdown } from '../core/output'
import { parseHTML, type HTMLReader } from '../core/prepare'

export type { HTMLReader }

export interface MarkdownToBlocksOptions {
  /**
   * Turns Markdown into HTML. Defaults to markdown-it with HTML allowed
   * (the HTML is read like pasted HTML, so only what the extensions know
   * is kept); pass your own to add syntax.
   */
  render?: (markdown: string) => string
  /**
   * Reads the HTML. Defaults to the global `DOMParser`; where there is none
   * (Node, Bun), pass one from a DOM library such as happy-dom or linkedom.
   */
  domParser?: HTMLReader
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

/** Read Markdown as blocks. Needs a `DOMParser`: the browser's, or `options.domParser`. */
export function markdownToBlocks(
  markdown: string,
  extensions: EditorExtensionList,
  options: MarkdownToBlocksOptions = {},
): Block[] {
  return parseHTML((options.render ?? render)(markdown), kitOf(extensions), options.domParser)
}
