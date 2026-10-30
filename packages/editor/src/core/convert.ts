import {
  resolveEditorExtensions,
  type EditorExtension,
  type ResolvedEditorExtensions,
} from './extension'
import type { Block, PartialBlock } from './model'
import { writeHTML } from './output'
import { parseHTML } from './prepare'

export type ExtensionList = readonly (EditorExtension | EditorExtension[])[]

const resolved = new WeakMap<ExtensionList, ResolvedEditorExtensions>()

/** Resolve a list of extensions once; the same array gives the same result. */
export function kitOf(extensions: ExtensionList): ResolvedEditorExtensions {
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
export function blocksToHTML(blocks: PartialBlock[], extensions: ExtensionList): string {
  return writeHTML(blocks, kitOf(extensions))
}

/** Read HTML as blocks with the given extensions. Needs `DOMParser` (a browser, or a DOM library). */
export function htmlToBlocks(html: string, extensions: ExtensionList): Block[] {
  return parseHTML(html, kitOf(extensions))
}
