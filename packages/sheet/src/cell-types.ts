import { CellCheck, CellOption } from './components/cell-renders'
import DatePanel from './components/date-panel.vue'
import OptionPanel from './components/option-panel.vue'
import { defineSheetCellType, optionOf, type SheetCellType } from './core/cell-type'
import { formatValue, parseInput } from './core/format'

/** A day: typed in or picked on a calendar under the cell. */
const date = defineSheetCellType({ name: 'date', panel: DatePanel })

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
  render: CellOption,
  panel: OptionPanel,
})

/** `true` or `false`, shown as a box that a click or `Space` checks. */
const checkbox = defineSheetCellType({
  name: 'checkbox',
  parse(text) {
    const value = parseInput(text).value
    if (value === 1 || value === 0) return { value: value === 1 }
    return typeof value === 'boolean' || value === null ? { value } : undefined
  },
  render: CellCheck,
  toggle: (value) => value !== true,
  align: 'center',
})

export const builtinCellTypes: readonly SheetCellType[] = [date, select, checkbox]
