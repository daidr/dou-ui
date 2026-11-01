import { defineSheetCellType, optionOf, type SheetCellType } from './cell-type'
import { formatValue, parseInput } from './format'

const DAY = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?$/
/** `11/30`, `11-30`, `11月30日`, `2026年11月30日`: a day without the year is in this one. */
const SHORT_DAY = /^(?:(\d{4})年)?(\d{1,2})(?:[/-]|月)(\d{1,2})日?$/

function shortDay(text: string) {
  const match = SHORT_DAY.exec(text.trim())
  if (!match) return undefined
  const [, y, m, d] = match
  const year = y ?? String(new Date().getFullYear())
  const iso = `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  const day = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(iso) ? iso : undefined
}

/** A day: typed in (in the common ways) or picked on a calendar under the cell. */
const date = defineSheetCellType({
  name: 'date',
  parse(text) {
    const day = shortDay(text)
    return day ? { value: day } : undefined
  },
  valid: (value, _, m) => (typeof value === 'string' && DAY.test(value)) || m.notDate,
})

/** One of the `options` of its setup, picked from a list under the cell. */
const select = defineSheetCellType({
  name: 'select',
  // typed text that names an option, in any case, is that option
  parse(text, setup) {
    const query = text.trim().toLowerCase()
    if (!query) return undefined
    for (const option of setup.options ?? []) {
      const { value } = optionOf(option)
      if (formatValue(value).toLowerCase() === query) return { value }
    }
    return undefined
  },
  valid: (value, setup, m) =>
    (setup.options ?? []).some((option) => optionOf(option).value === value) || m.notOption,
})

/** `true` or `false`, shown as a box that a click or `Space` checks. */
const checkbox = defineSheetCellType({
  name: 'checkbox',
  parse(text) {
    const value = parseInput(text).value
    if (value === 1 || value === 0) return { value: value === 1 }
    return typeof value === 'boolean' || value === null ? { value } : undefined
  },
  valid: (value, _, m) => typeof value === 'boolean' || m.notChecked,
  toggle: (value) => value !== true,
  align: 'center',
})

/**
 * The built-in types without what they draw or edit with, so files can be
 * read and written where there is no page, such as in a Worker.
 */
export const plainCellTypes: readonly SheetCellType[] = [date, select, checkbox]
