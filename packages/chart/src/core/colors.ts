/**
 * Canvas drawing needs real colors, while the theme speaks in CSS
 * variables (`var(--dou-color-chart-2)`, `color-mix(…)`). A hidden probe
 * inside the chart lets the browser work them out, as they apply there.
 */
export interface ColorResolver {
  (css: string): string
  /** Forget what was worked out (the theme changed). */
  clear(): void
}

export function createColorResolver(host: () => HTMLElement | null | undefined): ColorResolver {
  const cache = new Map<string, string>()
  let probe: HTMLElement | null = null
  const resolve = ((css: string) => {
    const known = cache.get(css)
    if (known) return known
    const root = host()
    if (!root || typeof getComputedStyle === 'undefined') return css
    if (!probe || probe.parentNode !== root) {
      probe = document.createElement('span')
      probe.setAttribute('aria-hidden', 'true')
      probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden'
      root.appendChild(probe)
    }
    probe.style.color = ''
    probe.style.color = css
    const color = getComputedStyle(probe).color || css
    cache.set(css, color)
    return color
  }) as ColorResolver
  resolve.clear = () => cache.clear()
  return resolve
}

/**
 * Calls `onChange` when the page's theme may have changed: the theme
 * attribute or class on `<html>` / `<body>`, or the system color scheme.
 */
export function observeTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  let pending = 0
  const notify = () => {
    if (pending) return
    // after the new styles apply
    pending = requestAnimationFrame(() => {
      pending = 0
      onChange()
    })
  }
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(notify)
  for (const el of [document.documentElement, document.body])
    observer?.observe(el, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-dou-theme'],
    })
  const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
  scheme?.addEventListener?.('change', notify)
  return () => {
    observer?.disconnect()
    scheme?.removeEventListener?.('change', notify)
    if (pending) cancelAnimationFrame(pending)
  }
}
