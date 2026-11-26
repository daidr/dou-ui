const TEXT_NODE = 3

function isAriaHidden(el: HTMLElement, root: HTMLElement): boolean {
  let current: HTMLElement | null = el
  while (current && current !== root) {
    if (current.getAttribute('aria-hidden') === 'true') return true
    current = current.parentElement
  }
  return false
}

function hasOwnTitle(el: HTMLElement, root: HTMLElement): boolean {
  let current: HTMLElement | null = el
  while (current && current !== root) {
    if (current.hasAttribute('title')) return true
    current = current.parentElement
  }
  return false
}

function clipsHorizontally(el: HTMLElement): boolean {
  const style = el.ownerDocument.defaultView?.getComputedStyle?.(el)
  if (!style) return true
  const overflowX = style.overflowX || style.overflow.split(/\s+/)[0] || ''
  return overflowX !== 'visible'
}

function collectVisibleText(el: HTMLElement): string {
  let text = ''
  for (const node of el.childNodes) {
    if (node.nodeType === TEXT_NODE) {
      text += node.textContent ?? ''
    } else if (node instanceof HTMLElement && node.getAttribute('aria-hidden') !== 'true') {
      text += collectVisibleText(node)
    }
  }
  return text
}

function visibleText(el: HTMLElement): string {
  return collectVisibleText(el).trim()
}

/**
 * When a candidate contains an ignored overflowing descendant (for example, a
 * trailing ripple pseudo-element that enlarges the parent's `scrollWidth`),
 * verify via text node geometry whether visible text actually overflows the
 * horizontal content box. Returns `undefined` when layout rects are unavailable
 * (such as non-layout DOM mocks) so callers fall back to `scrollWidth`.
 */
function hasVisibleTextOverflow(el: HTMLElement): boolean | undefined {
  const doc = el.ownerDocument
  if (typeof doc.createRange !== 'function') return undefined
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return undefined

  const range = doc.createRange()
  if (typeof range.getBoundingClientRect !== 'function') return undefined

  const style = doc.defaultView?.getComputedStyle?.(el)
  const borderLeft = Number.parseFloat(style?.borderLeftWidth || '0') || 0
  const borderRight = Number.parseFloat(style?.borderRightWidth || '0') || 0
  const paddingLeft = Number.parseFloat(style?.paddingLeft || '0') || 0
  const paddingRight = Number.parseFloat(style?.paddingRight || '0') || 0
  const contentLeft = rect.left + borderLeft + paddingLeft
  const contentRight = rect.right - borderRight - paddingRight

  let measured = false
  const check = (container: HTMLElement): boolean => {
    for (const node of container.childNodes) {
      if (node.nodeType === TEXT_NODE) {
        const raw = node.textContent ?? ''
        const trimmed = raw.trim()
        if (!trimmed) continue
        const start = raw.indexOf(trimmed)
        range.setStart(node, start)
        range.setEnd(node, start + trimmed.length)
        const textRect = range.getBoundingClientRect()
        if (textRect.width <= 0) continue
        measured = true
        if (textRect.left < contentLeft - 0.5 || textRect.right > contentRight + 0.5) {
          return true
        }
      } else if (node instanceof HTMLElement && node.getAttribute('aria-hidden') !== 'true') {
        if (check(node)) return true
      }
    }
    return false
  }

  const overflowed = check(el)
  return measured ? overflowed : undefined
}

function isConfirmedOverflow(el: HTMLElement, ignoredOverflowing: HTMLElement[]): boolean {
  if (!ignoredOverflowing.some((node) => el.contains(node))) return true
  return hasVisibleTextOverflow(el) ?? true
}

/**
 * Return the full text to show as a native `title` tooltip when `el` (or a
 * truncated descendant inside a custom `#label` slot) overflows horizontally.
 * Skips decorative or non-clipping descendants (such as `aria-hidden="true"`
 * subtrees, text-less nodes, or `overflow-x: visible` visual overflows like
 * ripple animations), and returns `undefined` when nothing is truncated or
 * when a truncated child already provides its own `title`.
 */
export function resolveTruncatedTitle(
  el: HTMLElement | null | undefined,
  explicitLabel?: string,
): string | undefined {
  if (!el) return undefined
  const fallback = explicitLabel?.trim() || undefined
  const candidates: HTMLElement[] = []
  const ignoredOverflowing: HTMLElement[] = []

  for (const child of el.querySelectorAll('*')) {
    if (!(child instanceof HTMLElement)) continue
    if (!(child.clientWidth > 0 && child.scrollWidth > child.clientWidth)) continue

    if (isAriaHidden(child, el) || !clipsHorizontally(child) || !visibleText(child)) {
      ignoredOverflowing.push(child)
      continue
    }

    candidates.push(child)
  }

  const matches: HTMLElement[] = []
  for (const candidate of candidates) {
    if (!isConfirmedOverflow(candidate, ignoredOverflowing)) continue
    const parentIndex = matches.findIndex((item) => item.contains(candidate))
    if (parentIndex !== -1) {
      matches[parentIndex] = candidate
    } else {
      matches.push(candidate)
    }
  }

  if (matches.length > 0) {
    let sawOwnedTitle = false
    for (const match of matches) {
      if (hasOwnTitle(match, el)) {
        sawOwnedTitle = true
        continue
      }
      return visibleText(match) || fallback
    }
    if (sawOwnedTitle) return undefined
  }

  if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth && clipsHorizontally(el)) {
    const text = visibleText(el)
    if (!text) return undefined
    if (!isConfirmedOverflow(el, ignoredOverflowing)) return undefined
    if (el.children.length > 0 && fallback) return fallback
    return text || fallback
  }
  return undefined
}
