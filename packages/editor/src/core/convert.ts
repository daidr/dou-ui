import {
  resolveEditorExtensions,
  type EditorExtension,
  type ResolvedEditorExtensions,
} from './extension'
import type { Block, PartialBlock } from './model'
import { writeHTML } from './output'
import { parseHTML, type DOMParserLike } from './prepare'

export type EditorExtensionList = readonly (EditorExtension | EditorExtension[])[]

const resolved = new WeakMap<EditorExtensionList, ResolvedEditorExtensions>()

/** Resolve a list of extensions once; the same array gives the same result. */
export function kitOf(extensions: EditorExtensionList): ResolvedEditorExtensions {
  let kit = resolved.get(extensions)
  if (!kit) {
    kit = resolveEditorExtensions(extensions)
    resolved.set(extensions, kit)
  }
  return kit
}

/**
 * Write blocks as HTML with the given extensions, e.g. to show a document
 * outside the editor. Works without a browser.
 */
export function blocksToHTML(blocks: PartialBlock[], extensions: EditorExtensionList): string {
  return writeHTML(blocks, kitOf(extensions))
}

export interface HTMLToBlocksOptions {
  /**
   * Reads the HTML. Defaults to the global `DOMParser`; where there is none
   * (Node, Bun), pass one from a DOM library such as happy-dom or linkedom.
   */
  domParser?: DOMParserLike
}

/** Read HTML as blocks with the given extensions. Needs a `DOMParser`: the browser's, or `options.domParser`. */
export function htmlToBlocks(
  html: string,
  extensions: EditorExtensionList,
  options: HTMLToBlocksOptions = {},
): Block[] {
  return parseHTML(html, kitOf(extensions), options.domParser)
}
