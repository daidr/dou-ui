import type { EditorExtension } from '../core/extension'
import { divider, heading, paragraph, quote } from './blocks'
import { codeBlock, type CodeBlockOptions } from './code-block'
import { formatting, link } from './formatting'
import { lists } from './lists'

export interface StarterKitOptions {
  heading?: boolean
  lists?: boolean
  quote?: boolean
  /** Options for the code block, e.g. its highlighter, or `false` to leave it out. */
  codeBlock?: boolean | CodeBlockOptions
  divider?: boolean
  formatting?: boolean
  link?: boolean
}

/**
 * The built-in blocks and formatting. Pass `false` for any part to leave
 * it out, e.g. `starterKit({ codeBlock: false })`.
 */
export function starterKit(options: StarterKitOptions = {}): EditorExtension[] {
  const code = options.codeBlock
  const parts = {
    heading,
    lists,
    quote,
    codeBlock: codeBlock(typeof code === 'object' ? code : {}),
    divider,
    formatting,
    link,
  }
  return [
    paragraph,
    ...Object.entries(parts)
      .filter(([name]) => options[name as keyof StarterKitOptions] !== false)
      .map(([, extension]) => extension),
  ]
}

export { codeBlock, divider, formatting, heading, link, lists, paragraph, quote }
