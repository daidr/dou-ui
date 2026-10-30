import type { FlowDocument } from './model'

/*
 * Copied nodes go to the system clipboard as JSON, so they paste into another
 * tab or a text box too. The last copy is also kept here as is: node data can
 * hold things JSON can't, and it is what a paste uses when the clipboard
 * still holds that same copy.
 */

const MARK = 'dou-flow'

let copied: { data: FlowDocument; text: string } | null = null

/** Remembers `data` and returns the text to put on the system clipboard. */
export function writeClipboard(data: FlowDocument) {
  const text = JSON.stringify({ [MARK]: 1, nodes: data.nodes, edges: data.edges })
  copied = { data, text }
  return text
}

/**
 * The nodes to paste: from the system clipboard's `text` when it holds a
 * copy, else the last copy made on this page. `null` when `text` is
 * something else.
 */
export function readClipboard(text?: string | null): FlowDocument | null {
  if (text == null || text === '') return copied?.data ?? null
  if (copied && text === copied.text) return copied.data
  try {
    const value = JSON.parse(text)
    if (value?.[MARK] && Array.isArray(value.nodes) && Array.isArray(value.edges))
      return { nodes: value.nodes, edges: value.edges }
  } catch {
    // Not ours.
  }
  return null
}
