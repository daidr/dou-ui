import { collaborationColors } from 'dou-ui'
import { nextTick, shallowRef, watch } from 'vue'
import * as Y from 'yjs'
import type { SheetBounds, SheetPoint } from '../core/address'
import { boundsOf } from '../core/address'
import type { SheetContext } from '../context'
import { defineSheetExtension, type SheetExtension } from '../core/extension'
import {
  colCountOf,
  rowCountOf,
  type SheetData,
  type SheetStyle,
  type SheetTypeSetup,
} from '../core/model'
import type { SheetSelection } from '../core/selection'
import {
  sheetKey,
  type SheetAxisName,
  type SheetPatch,
  type SheetTransaction,
} from '../core/transaction'
import { anchorCell, hasRefs, lineOf, resolveCell, SheetLayout, type SheetLines } from './anchor'
import { createPeers, type SheetPeer } from './peers'
import {
  ANCHORED_META,
  anchorMeta,
  cellAt,
  cellKey,
  fillBook,
  increasingRun,
  isMetaKey,
  layoutSheet,
  makeIds,
  partsOf,
  readLayout,
  readSheet,
  resolveMeta,
  sheetParts,
  syncList,
  writeSheet,
  type SharedMap,
  type SharedParts,
} from './shared'

export { fillBook, readBook } from './shared'

/** The part of an `Awareness` (`y-protocols/awareness`) the sheet uses. */
export interface AwarenessLike {
  clientID: number
  getLocalState(): Record<string, unknown> | null
  setLocalStateField(field: string, value: unknown): void
  getStates(): Map<number, Record<string, unknown>>
  on(event: 'change', listener: (...args: unknown[]) => void): void
  off(event: 'change', listener: (...args: unknown[]) => void): void
}

/** How the people editing together see each other. */
export interface CollaborationUser {
  name: string
  /** The color of this user's marks, any CSS color. Picked from the client id when left out. */
  color?: string
}

export interface CollaborationOptions {
  /** Where the workbook lives, e.g. `ydoc.getMap('book')`. */
  book: Y.Map<unknown>
  /** Shares what each person has selected and is editing (`y-protocols/awareness`). */
  awareness?: AwarenessLike
  /** This user, shown to the others. Needs `awareness`. */
  user?: CollaborationUser
}

/** A line by its id, or by number when it is past the lines the sheet has. */
type LineAt = string | number

/** What each person shares under the awareness field `sheet`: lines by id, so they read right everywhere. */
export interface SheetPresence {
  /** The `id` of the sheet they have open. */
  sheet: string
  /** Their active cell, `[row, col]`. */
  active: [LineAt, LineAt]
  /** What they have selected, each range `[top, left, bottom, right]`. */
  ranges: [LineAt, LineAt, LineAt, LineAt][]
  /** Whether they are editing the active cell. */
  editing: boolean
}

export { collaborationColors }

type Json = Record<string, unknown>

const same = (a: unknown, b: unknown) =>
  a === b ||
  ((a == null || a === '') && (b == null || b === '')) ||
  (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b))

const selectionOf = (active: SheetPoint, ranges: SheetBounds[]): SheetSelection => ({
  active,
  ranges: ranges.map((b) => ({
    start: { row: b.top, col: b.left },
    end: { row: b.bottom, col: b.right },
  })),
})

/** Writes the named styles or types a change touched. */
function writeNamed(names: Set<string>, map: SharedMap, own?: Record<string, unknown>) {
  for (const name of names) {
    const value = own?.[name]
    if (value === undefined) map.delete(name)
    else if (!same(map.get(name), value)) map.set(name, value)
  }
}

/** Writes the sizes of the lines a change touched, by line id. */
function writeSizes(
  keys: Set<string>,
  map: SharedMap,
  lines: SheetLines,
  own?: Record<number, number>,
) {
  for (const line of keys) {
    const at = lines.indexOf(line)
    if (at < 0) continue
    const size = own?.[at]
    if (size == null) map.delete(line)
    else if (map.get(line) !== size) map.set(line, size)
  }
}

const isEmpty = (cell: unknown) => cell == null || cell === ''

/** What the shared document changed, gathered over one Yjs transaction. */
interface SheetDirty {
  lines: { row: boolean; col: boolean }
  cells: Set<string>
  rowSizes: Set<string>
  colSizes: Set<string>
  meta: Set<string>
}

interface Dirty {
  /** Read everything again, e.g. after the workbook was filled anew. */
  all: boolean
  /** Sheets added, removed or moved. */
  sheets: boolean
  /** Sheets replaced whole. */
  whole: Set<string>
  /** A sheet was renamed: formulas naming it read anew. */
  names: boolean
  styles: Set<string>
  types: Set<string>
  bySheet: Map<string, SheetDirty>
}

const dirtyNone = (): Dirty => ({
  all: false,
  sheets: false,
  whole: new Set(),
  names: false,
  styles: new Set(),
  types: new Set(),
  bySheet: new Map(),
})

const isDirty = (d: Dirty) =>
  d.all ||
  d.sheets ||
  d.whole.size > 0 ||
  d.styles.size > 0 ||
  d.types.size > 0 ||
  d.bySheet.size > 0

function sheetDirty(dirty: Dirty, id: string) {
  let entry = dirty.bySheet.get(id)
  if (!entry)
    dirty.bySheet.set(
      id,
      (entry = {
        lines: { row: false, col: false },
        cells: new Set(),
        rowSizes: new Set(),
        colSizes: new Set(),
        meta: new Set(),
      }),
    )
  return entry
}

/** Notes what a Yjs event changed. Paths are from the `book` map. */
function collect(dirty: Dirty, event: Y.YEvent<any>) {
  const path = event.path
  const keys = event instanceof Y.YMapEvent ? event.keysChanged : new Set<string>()
  if (path.length === 0) return void (dirty.all = true)
  const [top, id, part] = path as string[]
  if (top === 'styles') for (const key of keys) dirty.styles.add(key)
  else if (top === 'types') for (const key of keys) dirty.types.add(key)
  else if (top === 'order') dirty.sheets = true
  else if (top === 'sheets') {
    if (path.length === 1) {
      dirty.sheets = true
      for (const key of keys) dirty.whole.add(key)
    } else if (path.length === 2) dirty.whole.add(id!)
    else {
      const entry = sheetDirty(dirty, id!)
      if (part === 'rows') entry.lines.row = true
      else if (part === 'cols') entry.lines.col = true
      else if (part === 'cells') for (const key of keys) entry.cells.add(key)
      else if (part === 'rowSizes') for (const key of keys) entry.rowSizes.add(key)
      else if (part === 'colSizes') for (const key of keys) entry.colSizes.add(key)
      else if (part === 'meta')
        for (const key of keys) {
          entry.meta.add(key)
          if (key === 'name') dirty.names = true
        }
    }
  }
}

/**
 * Steps that bring a sheet's lines from `from` to `to`, both lists of ids:
 * removed lines first, then the fewest moves, then the new lines. The
 * cells move with their lines; the new lines are empty.
 */
function stepLines(
  tr: SheetTransaction,
  sheet: string,
  axis: SheetAxisName,
  from: readonly string[],
  to: readonly string[],
) {
  const ids = from.slice()
  let changed = false
  const wanted = new Set(to)
  for (let i = ids.length - 1; i >= 0;) {
    if (wanted.has(ids[i]!)) {
      i--
      continue
    }
    let start = i
    while (start > 0 && !wanted.has(ids[start - 1]!)) start--
    tr.step({ type: 'removeLines', sheet, axis, index: start, count: i - start + 1 })
    ids.splice(start, i - start + 1)
    changed = true
    i = start - 1
  }
  const present = new Set(ids)
  const target = to.filter((id) => present.has(id))
  const rank = new Map(target.map((id, i) => [id, i]))
  const run = increasingRun(ids.map((id) => rank.get(id)!))
  const placed = new Set(ids.filter((_, i) => run.has(i)))
  target.forEach((id, k) => {
    if (placed.has(id)) return
    const at = ids.indexOf(id)
    ids.splice(at, 1)
    const dest = k === 0 ? 0 : ids.indexOf(target[k - 1]!) + 1
    ids.splice(dest, 0, id)
    placed.add(id)
    // `to` is numbered as before the move
    tr.step({
      type: 'moveLines',
      sheet,
      axis,
      from: at,
      count: 1,
      to: dest >= at ? dest + 1 : dest,
    })
    changed = true
  })
  for (let k = 0; k < to.length;) {
    if (present.has(to[k]!)) {
      k++
      continue
    }
    let end = k
    while (end < to.length && !present.has(to[end]!)) end++
    tr.step({ type: 'insertLines', sheet, axis, index: k, count: end - k })
    changed = true
    k = end
  }
  return changed
}

/**
 * Edit a workbook together through a Yjs document. Every row and column
 * has an id there; cells, sizes, formulas and rules are kept by those ids,
 * so two people inserting, deleting or moving lines at once keep each
 * other's cells in place, and formulas still point at the cells they were
 * written for. The grid's `v-model` only mirrors the shared workbook: a
 * workbook set through `v-model` from outside is not written back. Undo
 * only takes back this user's own changes. With `awareness`, each person
 * sees the others' selections and the cells they edit, in their colors.
 */
export function collaboration(options: CollaborationOptions): SheetExtension {
  const { book, awareness, user } = options
  const ydoc = book.doc
  if (!ydoc) throw new Error('[@dou-ui/sheet] the book map must be in a Y.Doc')
  if (awareness && user) {
    const color = user.color ?? collaborationColors[ydoc.clientID % collaborationColors.length]
    awareness.setLocalStateField('user', { name: user.name, color })
  }

  /** This grid's own changes, which undo can take back. */
  const tracked = { sheet: 'tracked' }
  /** Changes undo leaves alone, e.g. filling the shared workbook. */
  const untracked = { sheet: 'untracked' }
  const undoManager = new Y.UndoManager(book, {
    trackedOrigins: new Set([tracked]),
    captureTimeout: 500,
  })
  const ids = makeIds(ydoc)
  let context: SheetContext | undefined
  let parts: SharedParts | null = null
  /** The sheets and lines the grid shows, by id: the shared workbook as last applied. */
  let layout = new SheetLayout()
  /** Set while shared changes are applied to the grid, so they aren't written back. */
  let applying = false
  /** What undo or redo is running, to name the change. */
  let travelling: 'undo' | 'redo' | null = null
  let restore: StoredView | undefined
  let lastGroup: string | undefined
  /** Counts the changes applied from the shared workbook, for what draws by line ids. */
  const revision = shallowRef(0)

  // Selections, by line ids --------------------------------------------------------------

  interface StoredView {
    sheet: string
    active: [LineAt, LineAt]
    ranges: [LineAt, LineAt, LineAt, LineAt][]
  }

  function storeView(sheet: string, selection: SheetSelection): StoredView | undefined {
    const here = layout.sheets.get(sheet)
    if (!here) return undefined
    const row = (n: number): LineAt => here.rows.ids[n] ?? n
    const col = (n: number): LineAt => here.cols.ids[n] ?? n
    return {
      sheet,
      active: [row(selection.active.row), col(selection.active.col)],
      ranges: selection.ranges.slice(0, 20).map((range) => {
        const b = boundsOf(range)
        // whole rows and columns run past the last line
        return [row(b.top), col(b.left), row(b.bottom), col(b.right)]
      }),
    }
  }

  function readView(view: StoredView) {
    const here = layout.sheets.get(view.sheet)
    if (!here) return null
    const ranges: SheetBounds[] = []
    for (const [top, left, bottom, right] of view.ranges) {
      const b = {
        top: lineOf(here.rows, top),
        left: lineOf(here.cols, left),
        bottom: lineOf(here.rows, bottom),
        right: lineOf(here.cols, right),
      }
      if (b.top >= 0 && b.left >= 0 && b.bottom >= 0 && b.right >= 0)
        ranges.push({
          top: Math.min(b.top, b.bottom),
          left: Math.min(b.left, b.right),
          bottom: Math.max(b.top, b.bottom),
          right: Math.max(b.left, b.right),
        })
    }
    const row = lineOf(here.rows, view.active[0])
    const col = lineOf(here.cols, view.active[1])
    const active: SheetPoint | null =
      row >= 0 && col >= 0
        ? { row, col }
        : ranges[0]
          ? { row: ranges[0].top, col: ranges[0].left }
          : null
    return { active, ranges }
  }

  // Undo puts back the selection from before each change.
  undoManager.on('stack-item-added', (event: { stackItem: { meta: Map<string, unknown> } }) => {
    const id = context?.sheet.value.id
    const view = id != null && context ? storeView(id, context.selection.value) : undefined
    if (view) event.stackItem.meta.set('view', view)
  })
  undoManager.on('stack-item-popped', (event: { stackItem: { meta: Map<string, unknown> } }) => {
    restore = event.stackItem.meta.get('view') as StoredView | undefined
  })

  // Writing this grid's changes ----------------------------------------------------------

  interface Touched {
    cells: Set<string>
    rowSizes: Set<string>
    colSizes: Set<string>
    meta: Set<string>
    lines: { row: boolean; col: boolean }
    removed: { row: string[]; col: string[] }
  }

  /** Writes what a transaction changed into the shared workbook. */
  function writeChanges(tr: SheetTransaction, shared: SharedParts) {
    const touched = new Map<string, Touched>()
    const touch = (id: string) => {
      let entry = touched.get(id)
      if (!entry)
        touched.set(
          id,
          (entry = {
            cells: new Set(),
            rowSizes: new Set(),
            colSizes: new Set(),
            meta: new Set(),
            lines: { row: false, col: false },
            removed: { row: [], col: [] },
          }),
        )
      return entry
    }
    let sheetsChanged = false
    /** Sheets added in this change, also ones taken out and put back: written whole. */
    const fresh = new Set<string>()
    const styles = new Set<string>()
    const types = new Set<string>()

    // follow the lines through the steps, so each cell is known by the ids it had when written
    for (const step of tr.steps) {
      if (step.type === 'setStyle') styles.add(step.name)
      else if (step.type === 'setType') types.add(step.name)
      else if (step.type === 'insertSheet') {
        sheetsChanged = true
        if (step.data.id != null) fresh.add(step.data.id)
      } else if (step.type === 'removeSheet' || step.type === 'moveSheet') sheetsChanged = true
      else {
        const here = fresh.has(step.sheet) ? undefined : layout.sheets.get(step.sheet)
        if (!here) continue
        const t = touch(here.id)
        // a line past the ids known, e.g. a cell written below the last row
        const lineAt = (axis: SheetAxisName, index: number) => {
          const lines = axis === 'row' ? here.rows : here.cols
          if (index >= lines.ids.length) {
            lines.ids.push(...ids.many(index + 1 - lines.ids.length))
            lines.changed()
            t.lines[axis] = true
          }
          return lines.ids[index]!
        }
        if (step.type === 'setCell')
          t.cells.add(cellKey(lineAt('row', step.row), lineAt('col', step.col)))
        else if (step.type === 'setSize')
          (step.axis === 'row' ? t.rowSizes : t.colSizes).add(lineAt(step.axis, step.index))
        else if (step.type === 'updateSheet')
          for (const key of Object.keys(step.patch)) t.meta.add(key)
        else {
          const { axis } = step
          const lines = axis === 'row' ? here.rows : here.cols
          t.lines[axis] = true
          if (step.type === 'insertLines') {
            if (step.index > 0) lineAt(axis, step.index - 1)
            const added = ids.many(step.count)
            lines.ids.splice(step.index, 0, ...added)
            lines.changed()
            // what comes back with the lines, as when a removal is undone
            step.cells?.forEach((part, r) =>
              part?.forEach((cell, c) => {
                if (isEmpty(cell)) return
                t.cells.add(
                  axis === 'row'
                    ? cellKey(added[r]!, lineAt('col', c))
                    : cellKey(lineAt('row', r), added[c]!),
                )
              }),
            )
            step.sizes?.forEach((size, i) => {
              if (size != null) (axis === 'row' ? t.rowSizes : t.colSizes).add(added[i]!)
            })
          } else if (step.type === 'removeLines') {
            t.removed[axis].push(...lines.ids.splice(step.index, step.count))
            lines.changed()
          } else {
            lineAt(axis, Math.max(step.from + step.count, step.to) - 1)
            const block = lines.ids.splice(step.from, step.count)
            lines.ids.splice(step.to > step.from ? step.to - step.count : step.to, 0, ...block)
            lines.changed()
          }
        }
      }
    }

    const sheets = tr.doc.sheets
    const byId = new Map(sheets.map((sheet) => [sheet.id!, sheet]))
    if (sheetsChanged || sheets.some((sheet) => !layout.sheets.has(sheet.id!))) {
      for (const id of Array.from(layout.sheets.keys()))
        if (!byId.has(id) || fresh.has(id)) {
          shared.sheets.delete(id)
          layout.sheets.delete(id)
          touched.delete(id)
        }
      const added: SheetData[] = []
      for (const sheet of sheets)
        if (!layout.sheets.has(sheet.id!)) {
          layout.sheets.set(sheet.id!, layoutSheet(sheet, sheet.id!, ids))
          added.push(sheet)
        }
      for (const sheet of sheets) layout.sheets.get(sheet.id!)!.name = sheet.name
      for (const sheet of added)
        writeSheet(shared.sheets, sheet, layout.sheets.get(sheet.id!)!, layout)
      syncList(
        shared.order,
        sheets.map((sheet) => sheet.id!),
      )
    }
    // renames, so formulas name the sheets as they are called now
    for (const sheet of sheets) {
      const here = layout.sheets.get(sheet.id!)
      if (here) here.name = sheet.name
    }

    for (const [id, t] of touched) {
      const here = layout.sheets.get(id)
      const sheet = byId.get(id)
      const lists = sheetParts(shared.sheets.get(id))
      if (!here || !sheet || !lists) continue
      // lines added past the last one or taken off the end with the count
      const fit = (axis: SheetAxisName, count: number) => {
        const lines = axis === 'row' ? here.rows : here.cols
        if (lines.ids.length < count) lines.ids.push(...ids.many(count - lines.ids.length))
        else if (lines.ids.length > count) t.removed[axis].push(...lines.ids.splice(count))
        else return
        lines.changed()
        t.lines[axis] = true
      }
      if (t.lines.row || t.meta.has('rowCount')) fit('row', rowCountOf(sheet))
      if (t.lines.col || t.meta.has('colCount')) fit('col', colCountOf(sheet))
      if (t.lines.row) syncList(lists.rows, here.rows.ids)
      if (t.lines.col) syncList(lists.cols, here.cols.ids)
      // the cells and sizes of removed lines go with them
      for (const row of t.removed.row) {
        for (const col of here.cols.ids) lists.cells.delete(cellKey(row, col))
        for (const col of t.removed.col) lists.cells.delete(cellKey(row, col))
        lists.rowSizes.delete(row)
      }
      for (const col of t.removed.col) {
        for (const row of here.rows.ids) lists.cells.delete(cellKey(row, col))
        lists.colSizes.delete(col)
      }
      for (const key of t.cells) {
        const { row, col } = cellAt(key, here)
        if (row < 0 || col < 0) continue
        const own = sheet.cells[row]?.[col]
        const existing = lists.cells.get(key)
        /*
         * A formula only moved along with inserted or deleted lines reads the
         * same from its anchors: leave it, so it doesn't overwrite what
         * someone else changed in it at the same time.
         */
        if (same(resolveCell(existing, here, layout), own)) continue
        const stored = anchorCell(own, here, layout)
        if (isEmpty(stored)) lists.cells.delete(key)
        else lists.cells.set(key, stored)
      }
      writeSizes(t.rowSizes, lists.rowSizes, here.rows, sheet.rowSizes)
      writeSizes(t.colSizes, lists.colSizes, here.cols, sheet.colSizes)
      for (const key of t.meta) {
        if (!isMetaKey(key)) continue
        const value = (sheet as unknown as Json)[key]
        const existing = lists.meta.get(key)
        // rules and merges that only moved with their lines, as for formulas
        if (key !== 'name' && same(resolveMeta(key, existing, here, layout), value)) continue
        if (value === undefined) lists.meta.delete(key)
        else {
          const stored = anchorMeta(key, value, here, layout)
          if (!same(existing, stored)) lists.meta.set(key, stored)
        }
      }
    }

    writeNamed(styles, shared.styles, tr.doc.styles)
    writeNamed(types, shared.types, tr.doc.types)
  }

  // Applying the shared workbook to the grid ---------------------------------------------

  /** Steps that bring the grid in line with the shared workbook, as `next` lays it out. */
  function applyShared(tr: SheetTransaction, shared: SharedParts, dirty: Dirty, next: SheetLayout) {
    const before = layout
    const inserted = new Set<string>()
    let refs = dirty.all || dirty.names

    const wanted = Array.from(next.sheets.keys())
    // an empty list is a workbook not filled yet: keep what is shown
    if ((dirty.all || dirty.sheets || dirty.whole.size) && wanted.length) {
      for (let i = tr.doc.sheets.length - 1; i >= 0; i--) {
        const sheet = tr.doc.sheets[i]!
        const id = sheet.id
        if (id == null || dirty.all || dirty.whole.has(id) || !next.sheets.has(id))
          tr.step({ type: 'removeSheet', sheet: sheetKey(sheet) })
      }
      wanted.forEach((id, index) => {
        const at = tr.indexOf(id)
        if (at === -1) {
          const here = next.sheets.get(id)!
          tr.step({
            type: 'insertSheet',
            index,
            data: readSheet(sheetParts(shared.sheets.get(id))!, here, next),
          })
          inserted.add(id)
        } else if (at !== index) tr.step({ type: 'moveSheet', sheet: id, index })
      })
      refs = true
    }

    for (const [id, here] of next.sheets) {
      if (inserted.has(id)) continue
      const d = dirty.bySheet.get(id)
      const old = before.sheets.get(id)
      const lists = sheetParts(shared.sheets.get(id))
      if (!d || !old || !lists || tr.indexOf(id) === -1) continue
      if (d.lines.row && stepLines(tr, id, 'row', old.rows.ids, here.rows.ids)) refs = true
      if (d.lines.col && stepLines(tr, id, 'col', old.cols.ids, here.cols.ids)) refs = true
      const counts: SheetPatch = {}
      if (rowCountOf(tr.getSheet(id)) !== here.rows.ids.length)
        counts.rowCount = here.rows.ids.length
      if (colCountOf(tr.getSheet(id)) !== here.cols.ids.length)
        counts.colCount = here.cols.ids.length
      if (Object.keys(counts).length) tr.updateSheet(counts, id)
      for (const key of d.cells) {
        const { row, col } = cellAt(key, here)
        if (row < 0 || col < 0) continue
        const cell = resolveCell(lists.cells.get(key), here, next)
        const at = { sheet: id, row, col }
        if (!same(tr.getCell(at), cell)) tr.setCell(at, cell)
      }
      const sizes = (axis: SheetAxisName, keys: Set<string>, map: SharedMap, lines: SheetLines) => {
        for (const line of keys) {
          const at = lines.indexOf(line)
          if (at < 0) continue
          const size = map.get(line)
          const own = tr.getSheet(id)[axis === 'row' ? 'rowSizes' : 'colSizes']?.[at]
          if (own !== size) tr.setSize(axis, at, typeof size === 'number' ? size : undefined, id)
        }
      }
      sizes('row', d.rowSizes, lists.rowSizes, here.rows)
      sizes('col', d.colSizes, lists.colSizes, here.cols)
      const patch: Json = {}
      for (const key of d.meta) {
        if (!isMetaKey(key)) continue
        const value = key === 'name' ? here.name : resolveMeta(key, lists.meta.get(key), here, next)
        if (!same((tr.getSheet(id) as unknown as Json)[key], value)) patch[key] = value
      }
      if (Object.keys(patch).length) tr.updateSheet(patch as SheetPatch, id)
    }

    // lines or names changed: every formula and rule reads its references again
    if (refs)
      for (const [id, here] of next.sheets) {
        if (inserted.has(id) || tr.indexOf(id) === -1) continue
        const lists = sheetParts(shared.sheets.get(id))
        if (!lists) continue
        lists.cells.forEach((stored, key) => {
          if (!hasRefs(stored)) return
          const { row, col } = cellAt(key, here)
          if (row < 0 || col < 0) return
          const cell = resolveCell(stored, here, next)
          const at = { sheet: id, row, col }
          if (!same(tr.getCell(at), cell)) tr.setCell(at, cell)
        })
        const patch: Json = {}
        for (const key of ANCHORED_META) {
          const value = resolveMeta(key, lists.meta.get(key), here, next)
          if (!same((tr.getSheet(id) as unknown as Json)[key], value)) patch[key] = value
        }
        if (Object.keys(patch).length) tr.updateSheet(patch as SheetPatch, id)
      }

    const styleNames = dirty.all
      ? new Set([...Object.keys(tr.doc.styles ?? {}), ...shared.styles.keys()])
      : dirty.styles
    for (const name of styleNames) {
      const value = shared.styles.get(name) as SheetStyle | undefined
      if (!same(tr.doc.styles?.[name], value)) tr.setStyle(name, value)
    }
    const typeNames = dirty.all
      ? new Set([...Object.keys(tr.doc.types ?? {}), ...shared.types.keys()])
      : dirty.types
    for (const name of typeNames) {
      const value = shared.types.get(name) as SheetTypeSetup | undefined
      if (!same(tr.doc.types?.[name], value)) tr.setType(name, value)
    }
  }

  /** Brings the grid in line with the shared workbook. */
  function pull(dirty: Dirty) {
    parts = partsOf(book)
    if (!context || !parts) return
    const shared = parts
    const next = readLayout(shared)
    const meta = { history: false, origin: travelling ?? 'remote' } as const
    // the selection stays on its cells when others insert, delete or move lines around it
    const shown = context.sheet.value.id
    const selected = shown != null ? storeView(shown, context.selection.value) : undefined
    const kept = context.selection.value
    applying = true
    try {
      context.transact((tr) => applyShared(tr, shared, dirty, next), meta)
    } catch (error) {
      console.error(
        '[@dou-ui/sheet] could not apply a shared change; reading the workbook again',
        error,
      )
      try {
        context.transact((tr) => applyShared(tr, shared, { ...dirtyNone(), all: true }, next), meta)
      } catch (again) {
        console.error('[@dou-ui/sheet] could not read the shared workbook', again)
      }
    } finally {
      applying = false
    }
    layout = next
    if (dirty.all) {
      // the sheets were read anew, under new keys: once the grid has shown the sheet
      // again, put back the selection, e.g. the one bound with `v-model:selection`
      const sheet = context
      void nextTick(() => {
        const now = sheet.selection.value
        if (now.active.row !== kept.active.row || now.active.col !== kept.active.col)
          sheet.select(kept)
      })
    } else if (selected && !travelling && context.sheet.value.id === selected.sheet) {
      const view = readView(selected)
      const current = context.selection.value
      if (
        view?.active &&
        view.ranges.length &&
        (view.active.row !== current.active.row || view.active.col !== current.active.col)
      )
        context.select(selectionOf(view.active, view.ranges))
    }
    revision.value++
    // a line two people moved at once is in the list twice: everyone takes out the same one
    tidyLists(shared)
  }

  function tidyLists(shared: SharedParts) {
    const repeated: [Y.Array<string>, string[]][] = []
    const check = (list: Y.Array<string>, known: string[]) => {
      if (list.length !== known.length) repeated.push([list, known])
    }
    check(shared.order, Array.from(layout.sheets.keys()))
    for (const here of layout.sheets.values()) {
      const sheet = sheetParts(shared.sheets.get(here.id))
      if (!sheet) continue
      check(sheet.rows, here.rows.ids)
      check(sheet.cols, here.cols.ids)
    }
    if (!repeated.length) return
    queueMicrotask(() =>
      ydoc!.transact(() => {
        for (const [list] of repeated) {
          const items = list.toArray()
          const first = new Map<string, number>()
          items.forEach((id, i) => first.has(id) || first.set(id, i))
          for (let i = items.length - 1; i >= 0; i--)
            if (first.get(items[i]!) !== i) list.delete(i, 1)
        }
      }, untracked),
    )
  }

  function run(action: 'undo' | 'redo') {
    const stack = action === 'undo' ? undoManager.undoStack : undoManager.redoStack
    if (!stack.length) return false
    travelling = action
    restore = undefined
    try {
      undoManager[action]()
    } finally {
      travelling = null
    }
    // set by the undo manager while it ran
    const popped = restore as StoredView | undefined
    restore = undefined
    const view = popped && readView(popped)
    if (view && context && popped) {
      context.showSheet(popped.sheet)
      if (view.active && view.ranges.length) context.select(selectionOf(view.active, view.ranges))
    }
    return true
  }

  // Others --------------------------------------------------------------------------------

  const peers = shallowRef<SheetPeer[]>([])

  return defineSheetExtension({
    name: 'collaboration',
    // after the other extensions, so it writes what they added
    priority: 0,
    transaction(tr) {
      if (applying || !parts) return
      // every sheet needs an id that stays when it is renamed, the same for everyone
      tr.doc.sheets.forEach((sheet, index) => {
        if (sheet.id != null) return
        let id = ids.next()
        while (tr.indexOf(id) !== -1) id = ids.next()
        tr.updateSheet({ id }, index)
      })
      const tracking = tr.meta.history !== false
      // like the grid's own history: only changes of one group undo together
      if (tracking && (!tr.meta.group || tr.meta.group !== lastGroup)) undoManager.stopCapturing()
      if (tracking) lastGroup = tr.meta.group
      const shared = parts
      ydoc.transact(() => writeChanges(tr, shared), tracking ? tracked : untracked)
      // the others' marks are kept by line ids: place them again
      if (tr.steps.some((step) => step.type.endsWith('Lines') || step.type.endsWith('Sheet')))
        revision.value++
    },
    history: () => ({
      undo: () => run('undo'),
      redo: () => run('redo'),
      canUndo: () => undoManager.undoStack.length > 0,
      canRedo: () => undoManager.redoStack.length > 0,
    }),
    // over the cells, under the grid's own marks, and kept out of the headers
    layers: awareness ? { below: [createPeers(peers)] } : undefined,
    setup(sheet) {
      context = sheet
      parts = partsOf(book)
      if (!parts) {
        // the first to open the workbook brings its sheets, each with an id
        applying = true
        try {
          sheet.transact(
            (tr) =>
              tr.doc.sheets.forEach((data, index) => {
                if (data.id == null) tr.updateSheet({ id: ids.next() }, index)
              }),
            { history: false },
          )
        } finally {
          applying = false
        }
        ydoc.transact(() => fillBook(book, sheet.doc.value), untracked)
        parts = partsOf(book)
        if (parts) layout = readLayout(parts)
      } else {
        layout = new SheetLayout()
        pull({ ...dirtyNone(), all: true })
      }

      // changes from others, and from undo: applied once per Yjs transaction
      let dirty = dirtyNone()
      const observe = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
        if (transaction.origin === tracked || transaction.origin === untracked) return
        for (const event of events) collect(dirty, event)
      }
      const flush = () => {
        if (!isDirty(dirty)) return
        const changes = dirty
        dirty = dirtyNone()
        pull(changes)
      }
      book.observeDeep(observe)
      ydoc.on('afterTransaction', flush)

      let stopPresence: (() => void) | undefined
      let readPeers: (() => void) | undefined
      if (awareness) {
        readPeers = () => {
          const list: SheetPeer[] = []
          awareness.getStates().forEach((state, client) => {
            if (client === awareness.clientID) return
            const who = state.user as { name?: string; color?: string } | undefined
            const presence = state.sheet as SheetPresence | null | undefined
            if (!who || !presence) return
            const view = readView(presence)
            if (!view) return
            list.push({
              client,
              name: who.name ?? '',
              color: who.color ?? 'currentColor',
              sheet: presence.sheet,
              active: view.active,
              ranges: view.ranges,
              editing: !!presence.editing,
            })
          })
          peers.value = list
        }
        readPeers()
        awareness.on('change', readPeers)
        // the others' lines may have moved: read where they are again
        const stopRevision = watch(revision, () => readPeers?.())
        /*
         * Nothing is shared until this person first comes to the grid, so a
         * selection nobody made doesn't show on the others' screens. After
         * that it stays shared while the grid is not focused.
         */
        let arrived = false
        const stopShare = watch(
          () => [
            sheet.focused.value,
            sheet.sheet.value.id,
            sheet.selection.value,
            sheet.editor.cell.value,
            revision.value,
          ],
          () => {
            arrived ||= sheet.focused.value || !!sheet.editor.cell.value
            if (!arrived) return
            const id = sheet.sheet.value.id
            const view = id != null ? storeView(id, sheet.selection.value) : undefined
            awareness.setLocalStateField(
              'sheet',
              view
                ? ({ ...view, editing: !!sheet.editor.cell.value } satisfies SheetPresence)
                : null,
            )
          },
          { immediate: true },
        )
        stopPresence = () => {
          stopRevision()
          stopShare()
        }
      }

      return () => {
        book.unobserveDeep(observe)
        ydoc.off('afterTransaction', flush)
        stopPresence?.()
        if (readPeers) awareness?.off('change', readPeers)
        awareness?.setLocalStateField('sheet', null)
        context = undefined
      }
    },
  })
}
