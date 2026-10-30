import type { FlowDocument } from './model'

/*
 * Copied nodes, shared by every editor on the page so they can be pasted
 * from one into another.
 */
let copied: FlowDocument | null = null

export function writeClipboard(data: FlowDocument) {
  copied = data
}

export function readClipboard() {
  return copied
}
