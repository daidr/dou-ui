/** A field to fit: its element and the least and most height it may take. */
export interface AutosizeField {
  el: HTMLTextAreaElement
  min: number
  max: number
}

/**
 * Sets each field's height to its content, between its least and most.
 * All fields collapse first and are read together, so the layout is
 * worked out once however many there are.
 */
export function fit(fields: readonly AutosizeField[]) {
  // Collapse first, so the scroll height reports the content and not the
  // height the field had before.
  for (const { el } of fields) el.style.height = 'auto'
  const contents = fields.map(({ el }) => el.scrollHeight)
  fields.forEach(({ el, min, max }, index) => {
    const content = contents[index]!
    el.style.height = `${Math.min(Math.max(content, min), max)}px`
    el.style.overflowY = content > max ? 'auto' : 'hidden'
  })
}

const queue = new Set<() => AutosizeField | null>()

/** Fits the field `measure` gives in a microtask, with every other one asked for by then. */
export function fitLater(measure: () => AutosizeField | null) {
  if (!queue.size) queueMicrotask(flush)
  queue.add(measure)
}

function flush() {
  const measures = [...queue]
  queue.clear()
  const fields: AutosizeField[] = []
  for (const measure of measures) {
    const field = measure()
    if (field) fields.push(field)
  }
  if (fields.length) fit(fields)
}

/** Whether the browser sizes a field to its content itself (`field-sizing: content`). */
export function sizedByStyle() {
  return typeof CSS !== 'undefined' && !!CSS.supports?.('field-sizing', 'content')
}
