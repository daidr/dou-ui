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

const isWideTable = (content: HTMLElement) =>
  content.classList.contains('dou-editor__content--table')

/**
 * Where a block's content goes across: its box, less what a top-level
 * table's frame reaches into the margins (its start padding and end margin),
 * which keeps the table in line with the text. The editor lays out left to
 * right, so the logical start and end are the left and right.
 */
export function contentSpan(content: HTMLElement): { left: number; right: number } {
  const rect = content.getBoundingClientRect()
  if (!isWideTable(content)) return { left: rect.left, right: rect.right }
  const style = getComputedStyle(content)
  return {
    left: rect.left + (Number.parseFloat(style.paddingInlineStart) || 0),
    right: rect.right + (Number.parseFloat(style.marginInlineEnd) || 0),
  }
}

/**
 * Where the block handle goes: before the content, or before what shows of
 * a table, whose left edge moves out into the margin as it scrolls.
 */
export function handleLeft(content: HTMLElement): number {
  const rect = content.getBoundingClientRect()
  if (!isWideTable(content)) return rect.left
  const table = content.querySelector('table')
  return table ? Math.max(rect.left, table.getBoundingClientRect().left) : contentSpan(content).left
}

/** The right edge of the editor's text column: the surface less its padding (a reading width). */
export function columnRight(surface: HTMLElement): number {
  const padding = Number.parseFloat(getComputedStyle(surface).paddingRight) || 0
  return surface.getBoundingClientRect().right - padding
}
