import type { Component } from 'vue'
import type { SheetInput } from './format'
import type {
  SheetCell,
  SheetSelectOption,
  SheetTypeSetup,
  SheetValue,
  SheetWorkbook,
} from './model'

/*
 * Cell types. A cell's `type` names one, directly (`'date'`) or through a
 * named setup in the workbook's `types` (`'status'` →
 * `{ type: 'select', options: [...] }`). The type decides how the value
 * shows, what typed text becomes, and what opens beside the editor.
 */

/** What a type's `render` component gets. */
export interface SheetCellRenderProps {
  value: SheetValue
  /** The value as text, formatted as the cell would show it. */
  text: string
  setup: SheetTypeSetup
  /** Whether the grid is read-only. */
  readonly: boolean
}

/** What a type's `panel` component gets. */
export interface SheetCellPanelProps {
  /** The value in the cell when editing began. */
  value: SheetValue
  /** What is typed in the editor now. */
  text: string
  /** Whether anything was typed since editing began. */
  typed: boolean
  setup: SheetTypeSetup
}

/**
 * What a type's `panel` may expose: keys the editor passes on first, e.g.
 * the arrow keys to move through a list. Return `true` when handled.
 */
export interface SheetCellPanelExpose {
  onKey?: (event: KeyboardEvent) => boolean
}

export interface SheetCellType {
  /** The name cells refer to with `type`. */
  name: string
  /**
   * Reads typed or pasted text. Return `undefined` to read it as any cell
   * does (numbers, dates, `TRUE`…).
   */
  parse?: (text: string, setup: SheetTypeSetup) => SheetInput | undefined
  /** The text shown for a value; by default the value with the cell's `format`. */
  format?: (value: SheetValue, setup: SheetTypeSetup) => string | undefined
  /**
   * Drawn in the cell instead of its text; props are `SheetCellRenderProps`.
   * Keep it light: it is drawn for every visible cell of the type. An
   * element in it with `data-sheet-toggle` switches the value on a click.
   */
  render?: Component
  /**
   * Shown under the cell while it is edited, such as a calendar. Props are
   * `SheetCellPanelProps`; emit `pick` with a value to write it and finish.
   */
  panel?: Component
  /**
   * Switches the value instead of opening the editor: on `Space` (for every
   * selected cell of the type), `Enter`, a double click or a click on a
   * `data-sheet-toggle` element.
   */
  toggle?: (value: SheetValue, setup: SheetTypeSetup) => SheetValue
  /** Where the content sits when the cell's style doesn't say. */
  align?: 'left' | 'center' | 'right'
}

/** Declares a cell type; only gives it a type. */
export function defineSheetCellType(type: SheetCellType): SheetCellType {
  return type
}

/** A cell's type, resolved: what it is and its settings. */
export interface SheetResolvedType {
  type: SheetCellType
  setup: SheetTypeSetup
}

const bare = new Map<string, SheetTypeSetup>()
const setupOf = (name: string) => {
  let setup = bare.get(name)
  if (!setup) bare.set(name, (setup = { type: name }))
  return setup
}

/** The type of a cell, or `undefined` when it has none or the type isn't known. */
export function resolveCellType(
  cell: SheetCell | undefined,
  book: SheetWorkbook,
  types: ReadonlyMap<string, SheetCellType>,
): SheetResolvedType | undefined {
  const name = cell?.type
  if (!name) return undefined
  const setup = book.types?.[name] ?? setupOf(name)
  const type = types.get(setup.type)
  return type ? { type, setup } : undefined
}

/** A `select` option as a value with an optional tone. */
export function optionOf(option: SheetSelectOption) {
  return option !== null && typeof option === 'object' ? option : { value: option }
}
