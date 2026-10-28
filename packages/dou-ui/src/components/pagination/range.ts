import type { PaginationItem } from './pagination'

/**
 * The pages to show: `boundaries` pages at each end, `siblings` pages on
 * each side of the current one, and a gap wherever pages are left out.
 * The row has the same length on every page, so the buttons never shift
 * under the pointer while paging through.
 */
const page = (n: number): PaginationItem => ({ type: 'page', page: n })
const pages = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => page(from + i))

export function paginationRange(
  current: number,
  count: number,
  siblings: number,
  boundaries: number,
): PaginationItem[] {
  // boundaries + gap + siblings + current + siblings + gap + boundaries
  const slots = boundaries * 2 + siblings * 2 + 3
  if (count <= slots) return pages(1, count)

  const start = Math.min(
    Math.max(current - siblings, boundaries + 2),
    count - boundaries - 1 - siblings * 2,
  )
  const end = start + siblings * 2

  const items: PaginationItem[] = pages(1, boundaries)
  // A gap of a single page shows that page instead of an ellipsis.
  if (start === boundaries + 2) items.push(page(boundaries + 1))
  else items.push({ type: 'ellipsis', key: 'start' })
  items.push(...pages(start, end))
  if (end === count - boundaries - 1) items.push(page(count - boundaries))
  else items.push({ type: 'ellipsis', key: 'end' })
  items.push(...pages(count - boundaries + 1, count))
  return items
}
