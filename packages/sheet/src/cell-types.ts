import { CellCheck, CellOption } from './components/cell-renders'
import DatePanel from './components/date-panel.vue'
import OptionPanel from './components/option-panel.vue'
import type { SheetCellType } from './core/cell-type'
import { plainCellTypes } from './core/plain-cell-types'

// what the grid draws and edits the built-in types with
const editors: Record<string, Partial<SheetCellType>> = {
  date: { panel: DatePanel },
  select: { render: CellOption, panel: OptionPanel },
  checkbox: { render: CellCheck },
}

export const builtinCellTypes: readonly SheetCellType[] = plainCellTypes.map((type) => ({
  ...type,
  ...editors[type.name],
}))
