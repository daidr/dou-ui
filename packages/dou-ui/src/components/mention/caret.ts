// Styles that change where text lands, copied onto the mirror.
const COPIED = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'letterSpacing',
  'lineHeight',
  'textIndent',
  'textTransform',
  'tabSize',
  'wordSpacing',
  'whiteSpace',
  'overflowWrap',
  'wordBreak',
] as const

/**
 * Where the caret would be drawn at `index` in a textarea, in viewport
 * coordinates: the text up to it is laid out in an invisible copy of the
 * field and the position of a marker after it is read.
 */
export function caretRect(field: HTMLTextAreaElement, index: number) {
  const style = getComputedStyle(field)
  const mirror = document.createElement('div')
  for (const name of COPIED) mirror.style[name] = style[name]
  Object.assign(mirror.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    visibility: 'hidden',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  })
  mirror.textContent = field.value.slice(0, index)
  const marker = document.createElement('span')
  marker.textContent = '​'
  mirror.append(marker)
  document.body.append(mirror)
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.4
  const offsetLeft = marker.offsetLeft
  const offsetTop = marker.offsetTop
  mirror.remove()
  const box = field.getBoundingClientRect()
  return new DOMRect(
    box.left + offsetLeft - field.scrollLeft,
    box.top + offsetTop - field.scrollTop,
    0,
    lineHeight,
  )
}

/** The mention being typed just before `caret`: a prefix at a word start and the text after it. */
export function findMention(text: string, caret: number, prefixes: string[]) {
  const before = text.slice(0, caret)
  let best: { prefix: string; start: number } | null = null
  for (const prefix of prefixes) {
    const start = before.lastIndexOf(prefix)
    if (start < 0 || (best && start < best.start)) continue
    best = { prefix, start }
  }
  if (!best) return null
  const query = before.slice(best.start + best.prefix.length)
  // A mention starts a word and runs to the caret without spaces.
  if (/\s/.test(query)) return null
  if (best.start > 0 && !/\s/.test(before[best.start - 1]!)) return null
  return { ...best, query }
}
