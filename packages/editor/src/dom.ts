import type { EditorView } from 'prosemirror-view'

/**
 * The content element (paragraph, heading, …) at height `y` in viewport
 * coordinates: the last one whose top is above it. Contents follow each
 * other from top to bottom in document order, nested ones included, so
 * a binary search does.
 */
export function contentAt(view: EditorView, y: number): HTMLElement | null {
  const list = view.dom.querySelectorAll<HTMLElement>('.dou-editor__content')
  let low = 0
  let high = list.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (list[middle]!.getBoundingClientRect().top <= y) {
      found = middle
      low = middle + 1
    } else high = middle - 1
  }
  return list[Math.max(found, 0)] ?? null
}

/** The block element around a content element. */
export function blockElementOf(content: HTMLElement): HTMLElement | null {
  return content.closest<HTMLElement>('.dou-editor__block')
}

/** The nearest ancestor that scrolls vertically, or `null` for the page. */
export function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight)
      return node
  }
  return null
}

/** Where the first line of a content element sits: its top and height. */
export function firstLine(content: HTMLElement): { top: number; height: number } {
  const rect = content.getBoundingClientRect()
  const style = getComputedStyle(content)
  const lineHeight = Number.parseFloat(style.lineHeight)
  const padding = Number.parseFloat(style.paddingTop) || 0
  const height = Number.isFinite(lineHeight) ? Math.min(lineHeight, rect.height) : rect.height
  return { top: rect.top + (height < rect.height ? padding : 0), height }
}
