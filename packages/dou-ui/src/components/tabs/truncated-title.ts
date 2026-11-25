/**
 * Return the full text to show as a native `title` tooltip when `el` (or a
 * truncated descendant inside a custom `#label` slot) overflows horizontally.
 * Returns `undefined` when nothing is truncated or when a truncated child
 * already provides its own `title`.
 */
export function resolveTruncatedTitle(
  el: HTMLElement | null | undefined,
  explicitLabel?: string,
): string | undefined {
  if (!el) return undefined
  const fallback = explicitLabel?.trim() || undefined
  let match: HTMLElement | undefined
  for (const child of el.querySelectorAll('*')) {
    if (
      child instanceof HTMLElement &&
      child.clientWidth > 0 &&
      child.scrollWidth > child.clientWidth &&
      (!match || match.contains(child))
    ) {
      match = child
    }
  }
  if (match) {
    let current: HTMLElement | null = match
    while (current && current !== el) {
      if (current.hasAttribute('title')) return undefined
      current = current.parentElement
    }
    return match.textContent?.trim() || fallback
  }
  if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth) {
    if (el.children.length > 0 && fallback) return fallback
    return el.textContent?.trim() || fallback
  }
  return undefined
}
