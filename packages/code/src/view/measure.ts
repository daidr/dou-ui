import { clusterStarts, isAscii } from '../core/chars'

/**
 * Text metrics without reading layout per line: every plain ASCII
 * character is one monospace cell, and anything else (CJK, emoji, accents)
 * is measured once in the page's own font and remembered. Tabs reach to
 * the next tab stop.
 */
/** A length read from computed styles, in px. */
function px(value: string, fallback: number) {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? Math.max(0, n) : fallback
}

export class Measure {
  /** Width of one monospace cell. */
  cell = 8
  lineHeight = 20
  /** Space above the first line and below the last (`--dou-code-editor-padding-y`). */
  padY = 8
  /** Space before and after each line (`--dou-code-editor-padding-x`). */
  padX = 12
  tabSize = 2
  private widths = new Map<string, number>()

  constructor(private readonly probe: () => HTMLElement | null | undefined) {}

  /** Reads the cell width and line height again, e.g. after the font changed. */
  refresh(tabSize: number) {
    this.tabSize = tabSize
    this.widths.clear()
    const el = this.probe()
    if (!el) return
    el.textContent = 'x'.repeat(64)
    const rect = el.getBoundingClientRect()
    if (rect.width > 0) this.cell = rect.width / 64
    if (rect.height > 0) this.lineHeight = Math.round(rect.height)
    el.textContent = ''
    // Through a padding, so a calc() in the variable comes out in pixels.
    el.style.padding =
      'var(--dou-code-editor-padding-y, 8px) var(--dou-code-editor-padding-x, 12px)'
    const style = getComputedStyle(el)
    this.padY = px(style.paddingTop, 8)
    this.padX = px(style.paddingLeft, 12)
    el.style.padding = ''
  }

  /** Width of one character as drawn. */
  width(cluster: string): number {
    const code = cluster.charCodeAt(0)
    if (cluster.length === 1 && code >= 0x20 && code < 0x7f) return this.cell
    let width = this.widths.get(cluster)
    if (width !== undefined) return width
    const el = this.probe()
    if (el) {
      el.textContent = cluster
      width = el.getBoundingClientRect().width
      el.textContent = ''
    }
    // No layout (tests, a hidden editor): wide scripts take two cells.
    if (!width)
      width = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\ud83c-\ud83e]/.test(cluster)
        ? this.cell * 2
        : this.cell
    // Only keep it once the page has fonts, so a fallback guess isn't kept forever.
    if (el?.isConnected) this.widths.set(cluster, width)
    return width
  }

  private tab(x: number) {
    const stop = this.cell * this.tabSize
    return (Math.floor(x / stop + 1e-6) + 1) * stop
  }

  /** The x of column `col` in `text`, from the line's start. */
  x(text: string, col: number): number {
    col = Math.min(col, text.length)
    if (isAscii(text)) {
      if (!text.includes('\t')) return col * this.cell
      let x = 0
      for (let i = 0; i < col; i++) x = text.charCodeAt(i) === 9 ? this.tab(x) : x + this.cell
      return x
    }
    let x = 0
    const starts = clusterStarts(text)
    for (let i = 0; i < starts.length - 1 && starts[i]! < col; i++) {
      const cluster = text.slice(starts[i], starts[i + 1])
      x = cluster === '\t' ? this.tab(x) : x + this.width(cluster)
    }
    return x
  }

  /** The column nearest to `x` in `text`, on a character boundary. */
  col(text: string, x: number): number {
    if (x <= 0) return 0
    if (isAscii(text) && !text.includes('\t'))
      return Math.min(text.length, Math.round(x / this.cell))
    let left = 0
    const ascii = isAscii(text)
    const starts = ascii ? null : clusterStarts(text)
    const count = ascii ? text.length : starts!.length - 1
    for (let i = 0; i < count; i++) {
      const from = ascii ? i : starts![i]!
      const to = ascii ? i + 1 : starts![i + 1]!
      const cluster = text.slice(from, to)
      const right = cluster === '\t' ? this.tab(left) : left + this.width(cluster)
      if (x < (left + right) / 2) return from
      if (x < right) return to
      left = right
    }
    return text.length
  }
}
