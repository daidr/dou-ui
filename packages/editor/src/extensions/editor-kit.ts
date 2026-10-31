import type { EditorExtension } from '../core/extension'
import { divider, heading, paragraph, quote } from './blocks'
import { callout } from './callout'
import { codeBlock, type CodeBlockOptions } from './code-block'
import { formatting, link } from './formatting'
import { lists } from './lists'
import { table } from './table'
import { toggle } from './toggle'

export interface EditorKitOptions {
  heading?: boolean
  lists?: boolean
  quote?: boolean
  /** Options for the code block, e.g. its highlighter, or `false` to leave it out. */
  codeBlock?: boolean | CodeBlockOptions
  divider?: boolean
  toggle?: boolean
  callout?: boolean
  table?: boolean
  formatting?: boolean
  link?: boolean
}

/**
 * The built-in blocks and formatting. Pass `false` for any part to leave
 * it out, e.g. `editorKit({ codeBlock: false })`.
 */
export function editorKit(options: EditorKitOptions = {}): EditorExtension[] {
  const code = options.codeBlock
  const parts = {
    heading,
    lists,
    quote,
    codeBlock: codeBlock(typeof code === 'object' ? code : {}),
    divider,
    toggle,
    callout,
    table,
    formatting,
    link,
  }
  return [
    paragraph,
    ...Object.entries(parts)
      .filter(([name]) => options[name as keyof EditorKitOptions] !== false)
      .map(([, extension]) => extension),
  ]
}

export {
  callout,
  codeBlock,
  divider,
  formatting,
  heading,
  link,
  lists,
  paragraph,
  quote,
  table,
  toggle,
}
