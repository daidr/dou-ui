import type { EditorView } from 'prosemirror-view'

const isBlock = (element: Element): element is HTMLElement =>
  element.classList.contains('dou-editor__block')

/** The blocks right inside a container element: the editing area or a group. */
export const childBlocks = (container: Element): HTMLElement[] =>
  Array.from(container.children).filter(isBlock)

const contentOf = (block: HTMLElement) =>
  block.querySelector<HTMLElement>(':scope > .dou-editor__content')

const groupOf = (block: HTMLElement) =>
  block.querySelector<HTMLElement>(':scope > .dou-editor__group')

/** Where a block starts: its content's top, or its children's for a block without visible content (columns). */
function topOf(block: HTMLElement): number {
  const content = contentOf(block)
  const shown = content?.getClientRects().length ? content : (groupOf(block) ?? block)
  return shown.getBoundingClientRect().top
}

/** The last of `blocks` whose top is above `y` (the first when none is). */
function lastAbove(blocks: HTMLElement[], y: number): HTMLElement {
  let low = 0
  let high = blocks.length - 1
  let found = 0
  while (low <= high) {
    const middle = (low + high) >> 1
    if (topOf(blocks[middle]!) <= y) {
      found = middle
      low = middle + 1
    } else high = middle - 1
  }
  return blocks[found]!
}

/** The group of a set of columns, around an element in one of them. */
export const COLUMNS_GROUP = '.dou-editor__content--columns + .dou-editor__group'
/** The group of one column (its blocks). */
export const COLUMN_GROUP = '.dou-editor__content--column + .dou-editor__group'

/** Whether columns sit side by side; a narrow editor stacks them. */
export function sideBySide(columns: HTMLElement[]): boolean {
  return (
    columns.length > 1 &&
    Math.abs(columns[0]!.getBoundingClientRect().top - columns[1]!.getBoundingClientRect().top) < 1
  )
}

/**
 * The column at `x` among side-by-side ones: the gap before a column
 * belongs to it (its handle sits there), what is left of the first to the
 * first and right of the last to the last.
 */
export function columnAtX(columns: HTMLElement[], x: number): number {
  let index = 0
  for (let next = 1; next < columns.length; next++)
    if (x >= columns[next - 1]!.getBoundingClientRect().right) index = next
  return index
}

/**
 * The content element (paragraph, heading, …) at height `y` in viewport
 * coordinates: the last one whose top is above it, nested ones included.
 * Blocks follow each other from top to bottom, so a binary search finds
 * the block, then the same again among its children. In a set of
 * columns, `x` picks the column (stacked columns go by `y` too).
 */
export function contentAt(view: EditorView, y: number, x?: number): HTMLElement | null {
  let container: Element = view.dom
  for (;;) {
    const blocks = childBlocks(container)
    if (!blocks.length) return null
    const block = lastAbove(blocks, y)
    const content = contentOf(block)
    const group = groupOf(block)
    if (group && content?.classList.contains('dou-editor__content--columns')) {
      const columns = childBlocks(group)
      if (!columns.length) return null
      const column =
        x !== undefined && sideBySide(columns)
          ? columns[columnAtX(columns, x)]!
          : lastAbove(columns, y)
      const inner = groupOf(column)
      if (!inner) return null
      container = inner
      continue
    }
    // the children, when shown (a closed toggle hides them) and `y` reaches them
    const first = group?.getClientRects().length ? childBlocks(group)[0] : undefined
    if (group && first && topOf(first) <= y) {
      container = group
      continue
    }
    return content
  }
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
