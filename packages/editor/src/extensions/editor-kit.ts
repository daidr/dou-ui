import type { EditorExtension } from '../core/extension'
import { divider, heading, paragraph, quote } from './blocks'
import { align } from './align'
import { callout } from './callout'
import { colors } from './colors'
import { codeBlock, type CodeBlockOptions } from './code-block'
import { formatting, link } from './formatting'
import { lists } from './lists'
import { table } from './table'
import { toggle } from './toggle'

export interface EditorKitOptions {
  heading?: boolean
  lists?: boolean
  quote?: boolean
  /**
   * Options for the code block, e.g. its highlighter, or `false` to leave
   * it out. Another code block extension takes its place, e.g.
   * `codeEditorBlock()` from `@dou-ui/editor/code`.
   */
  codeBlock?: boolean | CodeBlockOptions | EditorExtension
  divider?: boolean
  toggle?: boolean
  callout?: boolean
  table?: boolean
  formatting?: boolean
  link?: boolean
  /** Text and background colors. */
  colors?: boolean
  /** Aligning paragraphs, headings and quotes. */
  align?: boolean
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
    codeBlock:
      typeof code === 'object' && 'name' in code
        ? code
        : codeBlock(typeof code === 'object' ? code : {}),
    divider,
    toggle,
    callout,
    table,
    formatting,
    link,
    colors,
    align,
  }
  return [
    paragraph,
    ...Object.entries(parts)
      .filter(([name]) => options[name as keyof EditorKitOptions] !== false)
      .map(([, extension]) => extension),
  ]
}

export {
  align,
  callout,
  colors,
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
