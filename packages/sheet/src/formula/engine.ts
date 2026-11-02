import { rowCountOf, colCountOf, valueOf, type SheetData, type SheetWorkbook } from '../core/model'
import { parseCell, type SheetCellTarget, type SheetPoint } from '../core/address'
import { sheetKey, type SheetStep } from '../core/transaction'
import { CYCLE, isSheetError, NA, NAME, REF, SheetError, SYNTAX, VALUE, DIV0, NUM } from './error'
import {
  builtinFunctions,
  scalarOf,
  type SheetFunction,
  type SheetFunctionContext,
} from './functions'
import { parseFormula, referencesOf, type SheetFormulaNode } from './parse'
import {
  compareValues,
  dateText,
  isDateText,
  isRange,
  isTimeText,
  timeOrDays,
  toNumber,
  toText,
  type SheetArg,
  type SheetRangeArg,
  type SheetResult,
} from './values'

/*
 * Works out formulas when their results are asked for, and only those:
 * a grid asks for the cells it shows, so a big workbook costs only what is
 * on screen. A result is kept until a cell it depends on changes; a change
 * then forgets the results that depend on it, following what refers to
 * what, and nothing else.
 *
 * Working out one result runs on a stack of its own rather than by calling
 * itself, so a chain of 100 000 formulas each using the one before works.
 * A formula that needs results not worked out yet asks for all of them at
 * once, they are worked out first, and it runs again. One that needs
 * itself, directly or not, is `#CYCLE!`.
 */

/** Columns per row in a cell's number; rows are multiplied by it. */
const WIDTH = 16384
/** Ranges wider than this are checked one by one rather than by column. */
const WIDE = 64

interface Formula {
  slot: Slot
  row: number
  col: number
  pos: number
  /** `null` when the text isn't a formula. */
  node: SheetFormulaNode | null
  volatile: boolean
  /** Where it is registered as depending on cells, to take it out again. */
  cells: [Slot, number][]
  ranges: RangeDep[]
}

interface RangeDep {
  formula: Formula
  slot: Slot
  top: number
  left: number
  bottom: number
  right: number
}

interface Cell {
  slot: Slot
  row: number
  col: number
}

/** A sheet as the engine keeps it. */
interface Slot {
  key: string
  data: SheetData
  formulas: Map<number, Formula>
  results: Map<number, SheetResult>
  /** Where formulas that called `HYPERLINK` link to, kept with their results. */
  links: Map<number, string>
  /** Formulas referring to single cells, by the cell; most cells have one, kept without a set. */
  cellDeps: Map<number, Formula | Set<Formula>>
  /** Formulas referring to ranges, by column. */
  colDeps: Map<number, Set<RangeDep>>
  wideDeps: Set<RangeDep>
  /** When each row's results last changed, for redrawing only those rows. */
  versions: Map<number, number>
}

export interface SheetFormulaEngineOptions {
  /** More functions, or ones that replace built-in ones of the same name. */
  functions?: readonly SheetFunction[]
  /** The language `TEXT` writes dates in. */
  locale?: string
  /** The time `TODAY()` and `NOW()` use; the current time by default. */
  now?: () => Date
}

/** A change for `update`: a `SheetTransaction` is one. */
export interface SheetFormulaChange {
  /** The workbook after the change. */
  readonly doc: SheetWorkbook
  /** What changed. */
  readonly steps: readonly SheetStep[]
  /** The workbook before it: when it isn't the one the engine has, it starts over. */
  readonly before: SheetWorkbook
}

const pointOf = (at: SheetCellTarget | number, col?: number): SheetPoint | null =>
  typeof at === 'number' ? { row: at, col: col ?? 0 } : typeof at === 'string' ? parseCell(at) : at

const SYNTAX_NODE: SheetFormulaNode = { type: 'error', code: '#ERROR!' }

/**
 * The formulas of a workbook and their results. Load a workbook, ask for
 * results with `result`, and tell it about each change with `update`.
 */
export class SheetFormulaEngine {
  private slots = new Map<string, Slot>()
  private byName = new Map<string, Slot>()
  private functions = new Map<string, SheetFunction>()
  private parsed = new Map<string, SheetFormulaNode | null>()
  private volatiles = new Set<Formula>()
  private clock = 0
  private epoch = 0
  private context: SheetFunctionContext
  private now: () => Date
  /** Where the formula running links to, once it called `HYPERLINK`. */
  private linked: string | undefined
  /** The formulas the one running needed but had no results for. */
  private missing: Formula[] = []
  private current: SheetWorkbook = { version: 1, sheets: [] }

  /** The workbook it has. */
  get doc() {
    return this.current
  }

  constructor(doc?: SheetWorkbook, options: SheetFormulaEngineOptions = {}) {
    for (const fn of builtinFunctions) this.functions.set(fn.name.toUpperCase(), fn)
    for (const fn of options.functions ?? []) this.functions.set(fn.name.toUpperCase(), fn)
    this.now = options.now ?? (() => new Date())
    this.context = {
      now: this.now(),
      locale: options.locale,
      link: (target) => void (this.linked = target),
    }
    if (doc) this.load(doc)
  }

  /** The functions formulas can call, built in and added, by name. */
  functionList(): SheetFunction[] {
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    return [...this.functions.values()].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )
  }

  /** Whether a function of this name can be called, built in or added. */
  hasFunction(name: string) {
    return this.functions.has(name.toUpperCase())
  }

  /** Starts over with a workbook: every result is worked out again when asked for. */
  load(doc: SheetWorkbook) {
    this.current = doc
    this.slots.clear()
    this.byName.clear()
    this.volatiles.clear()
    // a long session can type many formulas; keep only what may come back
    if (this.parsed.size > 50_000) this.parsed.clear()
    this.epoch = ++this.clock
    this.context = { ...this.context, now: this.now() }
    for (const data of doc.sheets) {
      const slot: Slot = {
        key: sheetKey(data),
        data,
        formulas: new Map(),
        results: new Map(),
        links: new Map(),
        cellDeps: new Map(),
        colDeps: new Map(),
        wideDeps: new Set(),
        versions: new Map(),
      }
      this.slots.set(slot.key, slot)
      this.byName.set(data.name.toLowerCase(), slot)
    }
    for (const slot of this.slots.values()) {
      const cells = slot.data.cells
      for (let row = 0; row < cells.length; row++) {
        const line = cells[row]
        if (!line) continue
        for (let col = 0; col < line.length; col++) {
          const value = valueOf(line[col])
          if (typeof value === 'string' && value.startsWith('=')) this.add(slot, row, col, value)
        }
      }
    }
  }

  /**
   * Catches up with a change, such as a `SheetTransaction`: changes to
   * cells forget only the results depending on them; rows, columns or
   * sheets added, removed, moved or renamed start over, and so does a
   * change made to a workbook other than the one it has.
   */
  update(change: SheetFormulaChange) {
    const { doc, steps, before } = change
    if (before !== this.doc || steps.some(restructures)) return this.load(doc)
    this.current = doc
    for (const data of doc.sheets) {
      const slot = this.slots.get(sheetKey(data))
      if (!slot) return this.load(doc)
      slot.data = data
    }
    this.context = { ...this.context, now: this.now() }
    const changed: Cell[] = []
    for (const step of steps) {
      if (step.type !== 'setCell') continue
      const slot = this.slots.get(step.sheet)!
      const pos = step.row * WIDTH + step.col
      const old = slot.formulas.get(pos)
      const value = valueOf(step.cell)
      const formula = typeof value === 'string' && value.startsWith('=') ? value : null
      if (old) this.remove(old)
      if (formula) this.add(slot, step.row, step.col, formula)
      changed.push({ slot, row: step.row, col: step.col })
    }
    for (const f of this.volatiles) changed.push(f)
    this.forget(changed)
  }

  /**
   * What a cell comes to: its formula's result, or its value (`'=…` text
   * without its `'`, empty text as nothing). `sheet` is a sheet's key
   * (its `id`, or its name) or index; the cell is a name such as `'D7'`, a
   * point, or a row and a column.
   */
  result(sheet: string | number, cell: SheetCellTarget): SheetResult
  result(sheet: string | number, row: number, col: number): SheetResult
  result(sheet: string | number, at: SheetCellTarget | number, col?: number): SheetResult {
    const slot = this.slotOf(sheet)
    const point = pointOf(at, col)
    if (!slot || !point) return REF
    return this.read(slot, point.row, point.col, true)
  }

  /**
   * When the results in a row last changed, to redraw only rows whose
   * results did; any change to the workbook that starts over changes all.
   */
  rowVersion(sheet: string | number, row: number) {
    return this.slotOf(sheet)?.versions.get(row) ?? this.epoch
  }

  /**
   * Where a formula's cell links to, when the formula called `HYPERLINK`;
   * the cell as in `result`.
   */
  link(sheet: string | number, cell: SheetCellTarget): string | undefined
  link(sheet: string | number, row: number, col: number): string | undefined
  link(sheet: string | number, at: SheetCellTarget | number, col?: number) {
    const slot = this.slotOf(sheet)
    const point = pointOf(at, col)
    if (!slot || !point) return undefined
    const pos = point.row * WIDTH + point.col
    if (!slot.formulas.has(pos)) return undefined
    this.read(slot, point.row, point.col, true)
    return slot.links.get(pos)
  }

  /** Whether a cell holds a formula; the cell as in `result`. */
  isFormula(sheet: string | number, cell: SheetCellTarget): boolean
  isFormula(sheet: string | number, row: number, col: number): boolean
  isFormula(sheet: string | number, at: SheetCellTarget | number, col?: number) {
    const point = pointOf(at, col)
    return !!point && !!this.slotOf(sheet)?.formulas.has(point.row * WIDTH + point.col)
  }

  /** Works out a formula as if it were in a cell, without keeping it, e.g. for a preview while typing. */
  evaluate(formula: string, sheet: string | number = 0): SheetResult {
    const slot = this.slotOf(sheet)
    if (!slot) return REF
    const node = this.parse(formula) ?? SYNTAX_NODE
    const f: Formula = {
      slot,
      row: -1,
      col: -1,
      pos: -1,
      node,
      volatile: false,
      cells: [],
      ranges: [],
    }
    const missing = this.missing
    try {
      for (;;) {
        this.missing = []
        const value = this.run(f)
        if (!this.missing.length) return value
        // work out what it needs, then run it again
        for (const m of this.missing) if (!m.slot.results.has(m.pos)) this.compute(m)
      }
    } finally {
      this.missing = missing
    }
  }

  private slotOf(sheet: string | number) {
    if (typeof sheet === 'number') {
      const data = this.doc.sheets[sheet]
      return data ? this.slots.get(sheetKey(data)) : undefined
    }
    return this.slots.get(sheet)
  }

  private parse(text: string) {
    let node = this.parsed.get(text)
    if (node === undefined) {
      try {
        node = parseFormula(text)
      } catch {
        node = null
      }
      this.parsed.set(text, node)
    }
    return node
  }

  private add(slot: Slot, row: number, col: number, text: string) {
    const node = this.parse(text)
    const pos = row * WIDTH + col
    const volatile = !!node && this.isVolatile(node)
    const f: Formula = { slot, row, col, pos, node, volatile, cells: [], ranges: [] }
    slot.formulas.set(pos, f)
    if (volatile) this.volatiles.add(f)
    if (!node) return
    for (const ref of referencesOf(node)) {
      const target = ref.sheet == null ? slot : this.byName.get(ref.sheet.toLowerCase())
      if (!target) continue
      if (ref.cell) {
        const at = ref.top * WIDTH + ref.left
        const had = target.cellDeps.get(at)
        if (!had) target.cellDeps.set(at, f)
        else if (had instanceof Set) had.add(f)
        else if (had !== f) target.cellDeps.set(at, new Set([had, f]))
        f.cells.push([target, at])
        continue
      }
      const dep: RangeDep = {
        formula: f,
        slot: target,
        top: ref.top,
        left: ref.left,
        bottom: ref.bottom,
        right: ref.right,
      }
      f.ranges.push(dep)
      if (ref.right - ref.left >= WIDE) target.wideDeps.add(dep)
      else
        for (let c = ref.left; c <= ref.right; c++) {
          let set = target.colDeps.get(c)
          if (!set) target.colDeps.set(c, (set = new Set()))
          set.add(dep)
        }
    }
  }

  private isVolatile(node: SheetFormulaNode): boolean {
    switch (node.type) {
      case 'call':
        return (
          !!this.functions.get(node.name)?.volatile || node.args.some((arg) => this.isVolatile(arg))
        )
      case 'unary':
        return this.isVolatile(node.arg)
      case 'binary':
        return this.isVolatile(node.left) || this.isVolatile(node.right)
      default:
        return false
    }
  }

  private remove(f: Formula) {
    f.slot.formulas.delete(f.pos)
    this.volatiles.delete(f)
    for (const [target, at] of f.cells) {
      const had = target.cellDeps.get(at)
      if (had === f) target.cellDeps.delete(at)
      else if (had instanceof Set) had.delete(f)
    }
    for (const dep of f.ranges) {
      if (dep.right - dep.left >= WIDE) dep.slot.wideDeps.delete(dep)
      else for (let c = dep.left; c <= dep.right; c++) dep.slot.colDeps.get(c)?.delete(dep)
    }
  }

  /** Forgets the results of these cells and of every formula depending on them. */
  private forget(cells: Cell[]) {
    const queue = cells
    for (const { slot, row, col } of queue) {
      slot.results.delete(row * WIDTH + col)
      slot.versions.set(row, ++this.clock)
    }
    const visit = (f: Formula) => {
      // a result that isn't kept has nothing kept depending on it either,
      // and one forgotten already has been followed
      if (!f.slot.results.delete(f.pos)) return
      f.slot.versions.set(f.row, ++this.clock)
      queue.push(f)
    }
    for (let i = 0; i < queue.length; i++) {
      const { slot, row, col } = queue[i]!
      const direct = slot.cellDeps.get(row * WIDTH + col)
      if (direct instanceof Set) for (const f of direct) visit(f)
      else if (direct) visit(direct)
      const ranges = slot.colDeps.get(col)
      if (ranges)
        for (const dep of ranges) if (row >= dep.top && row <= dep.bottom) visit(dep.formula)
      for (const dep of slot.wideDeps)
        if (row >= dep.top && row <= dep.bottom && col >= dep.left && col <= dep.right)
          visit(dep.formula)
    }
  }

  /** A cell's value or result; `top` works out a result not kept yet, otherwise it is noted as missing. */
  private read(slot: Slot, row: number, col: number, top = false): SheetResult {
    const pos = row * WIDTH + col
    const f = slot.formulas.get(pos)
    if (f) {
      const kept = slot.results.get(pos)
      if (kept !== undefined) return kept
      if (top) return this.compute(f)
      this.missing.push(f)
      return null
    }
    const value = valueOf(slot.data.cells[row]?.[col])
    if (typeof value === 'string') {
      if (value === '') return null
      if (value.startsWith("'=")) return value.slice(1)
    }
    return value
  }

  /** Works out a formula's result, and first those it needs, one after another. */
  private compute(target: Formula): SheetResult {
    const stack = [target]
    /*
     * Formulas that ran and wait for what they need, which is above them on
     * the stack: each is worked out from those above it, so a formula
     * needing one that waits needs itself.
     */
    const waiting = new Set<Formula>()
    while (stack.length) {
      const f = stack[stack.length - 1]!
      // one asked for by two formulas is on the stack twice
      if (f.slot.results.has(f.pos)) {
        stack.pop()
        continue
      }
      const missing = this.missing
      this.missing = []
      this.linked = undefined
      let value = this.run(f)
      const link = this.linked
      const needed = this.missing
      this.missing = missing
      if (needed.length) {
        if (needed.some((m) => waiting.has(m) || m === f)) value = CYCLE
        else {
          // the first needed on top: in a column of running totals each then needs only the one done before
          for (let i = needed.length - 1; i >= 0; i--) {
            const m = needed[i]!
            if (!m.slot.results.has(m.pos)) stack.push(m)
          }
          waiting.add(f)
          continue
        }
      }
      f.slot.results.set(f.pos, value)
      if (link !== undefined) f.slot.links.set(f.pos, link)
      else f.slot.links.delete(f.pos)
      stack.pop()
      waiting.delete(f)
    }
    return target.slot.results.get(target.pos)!
  }

  private run(f: Formula): SheetResult {
    if (!f.node) return SYNTAX
    const value = this.scalar(this.ev(f.node, f.slot))
    return value ?? 0
  }

  private scalar(arg: SheetArg): SheetResult {
    return isRange(arg) ? scalarOf(arg) : arg
  }

  private range(slot: Slot, top: number, left: number, bottom: number, right: number): SheetArg {
    const lastRow = Math.min(bottom, rowCountOf(slot.data) - 1)
    const lastCol = Math.min(right, colCountOf(slot.data) - 1)
    if (top > lastRow || left > lastCol) return REF
    const range: SheetRangeArg = {
      kind: 'range',
      rows: lastRow - top + 1,
      cols: lastCol - left + 1,
      at: (r, c) => this.read(slot, top + r, left + c),
      entries: () => this.entries(slot, top, left, lastRow, lastCol),
    }
    return range
  }

  private *entries(
    slot: Slot,
    top: number,
    left: number,
    bottom: number,
    right: number,
  ): Generator<[number, number, SheetResult]> {
    const cells = slot.data.cells
    const end = Math.min(bottom, cells.length - 1)
    for (let row = top; row <= end; row++) {
      const line = cells[row]
      if (!line) continue
      const stop = Math.min(right, line.length - 1)
      for (let col = left; col <= stop; col++) {
        if (line[col] == null) continue
        const value = this.read(slot, row, col)
        if (value != null) yield [row - top, col - left, value]
      }
    }
  }

  private ev(node: SheetFormulaNode, slot: Slot): SheetArg {
    switch (node.type) {
      case 'number':
      case 'text':
      case 'boolean':
        return node.value
      case 'error':
        return SheetError.of(node.code)
      case 'empty':
        return null
      case 'ref': {
        const target = node.sheet == null ? slot : this.byName.get(node.sheet.toLowerCase())
        if (!target) return REF
        if (node.cell) return this.read(target, node.top, node.left)
        return this.range(target, node.top, node.left, node.bottom, node.right)
      }
      case 'unary': {
        const a = this.ev(node.arg, slot)
        if (isArray(a)) return cellByCell([a], (v) => unary(node.op, v))
        return unary(node.op, this.scalar(a))
      }
      case 'binary': {
        const a = this.ev(node.left, slot)
        const b = this.ev(node.right, slot)
        // a range given to an operator is worked out cell by cell, as in SUMPRODUCT((A1:A9="x")*B1:B9)
        if (isArray(a) || isArray(b))
          return cellByCell([a, b], (x, y) => this.binary(node.op, x, y))
        return this.binary(node.op, this.scalar(a), this.scalar(b))
      }
      case 'call': {
        const fn = this.functions.get(node.name)
        if (!fn) return NAME
        const count = node.args.length
        if (
          (fn.minArgs != null && count < fn.minArgs) ||
          (fn.maxArgs != null && count > fn.maxArgs)
        )
          return VALUE
        let out: SheetArg | undefined
        try {
          out = fn.lazy
            ? fn.run(
                node.args.map((arg) => () => this.ev(arg, slot)),
                this.context,
              )
            : fn.run(
                node.args.map((arg) => this.ev(arg, slot)),
                this.context,
              )
        } catch {
          return VALUE
        }
        return out === undefined ? null : out
      }
    }
  }

  private binary(op: string, a: SheetResult, b: SheetResult): SheetResult {
    if (isSheetError(a)) return a
    if (isSheetError(b)) return b
    if (op === '&') return (toText(a) as string) + (toText(b) as string)
    if (op.length === 2 || op === '=' || op === '<' || op === '>') {
      const c = compareValues(a, b)
      switch (op) {
        case '=':
          return c === 0
        case '<>':
          return c !== 0
        case '<':
          return c < 0
        case '>':
          return c > 0
        case '<=':
          return c <= 0
        default:
          return c >= 0
      }
    }
    const x = toNumber(a)
    if (isSheetError(x)) return x
    const y = toNumber(b)
    if (isSheetError(y)) return y
    let out: number
    switch (op) {
      case '+':
        out = x + y
        // a date and a number of days (or a time) is a date; a time and a time, or a part of a day, a time
        if (isDateText(a) !== isDateText(b)) return dateText(out)
        if (isTimeText(a) || isTimeText(b)) return clock(out)
        break
      case '-':
        out = x - y
        if (isDateText(a) && !isDateText(b)) return dateText(out)
        // two times apart is how long between them, as a time too
        if (isTimeText(a) && !isDateText(b)) return clock(out)
        break
      case '*':
        out = x * y
        break
      case '/':
        if (y === 0) return DIV0
        out = x / y
        break
      default:
        if (x === 0 && y < 0) return DIV0
        out = x ** y
    }
    return Number.isFinite(out) ? out : NUM
  }
}

const clock = (days: number): SheetResult => (Number.isFinite(days) ? timeOrDays(days) : NUM)

/** Whether an argument is a range of more than one cell. */
const isArray = (arg: SheetArg): arg is SheetRangeArg =>
  isRange(arg) && (arg.rows > 1 || arg.cols > 1)

function unary(op: string, v: SheetResult): SheetResult {
  if (isSheetError(v)) return v
  if (op === '+') return v
  const n = toNumber(v)
  if (isSheetError(n)) return n
  return op === '-' ? -n : n / 100
}

/** The cell of an argument that goes with `row` and `col` of `cellByCell`'s result. */
function pick(arg: SheetArg, row: number, col: number): SheetResult {
  if (!isRange(arg)) return arg
  const r = arg.rows === 1 ? 0 : row
  const c = arg.cols === 1 ? 0 : col
  return r < arg.rows && c < arg.cols ? arg.at(r, c) : NA
}

/**
 * Works out an operator for each cell of its ranges, into a range as big as
 * the biggest. A single value, or a range one row or column across, is used
 * for every row or column; past the end of a smaller range the cell is `#N/A`.
 */
function cellByCell(
  args: SheetArg[],
  run: (...values: SheetResult[]) => SheetResult,
): SheetRangeArg {
  let rows = 1
  let cols = 1
  for (const arg of args)
    if (isRange(arg)) {
      rows = Math.max(rows, arg.rows)
      cols = Math.max(cols, arg.cols)
    }
  const values: SheetResult[] = []
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) values.push(run(...args.map((arg) => pick(arg, row, col))))
  return {
    kind: 'range',
    rows,
    cols,
    at: (row, col) => values[row * cols + col] ?? null,
    *entries() {
      for (let i = 0; i < values.length; i++)
        if (values[i] != null) yield [Math.floor(i / cols), i % cols, values[i]!]
    },
  }
}

const restructures = (step: SheetStep) =>
  step.type === 'insertLines' ||
  step.type === 'removeLines' ||
  step.type === 'moveLines' ||
  step.type === 'insertSheet' ||
  step.type === 'removeSheet' ||
  (step.type === 'updateSheet' &&
    ('name' in step.patch ||
      'id' in step.patch ||
      'rowCount' in step.patch ||
      'colCount' in step.patch))
