import {
  applySheetSteps,
  compactSheetSteps,
  type SheetStep,
  type SheetTransaction,
} from './transaction'
import type { SheetWorkbook } from './model'
import type { SheetSelection } from './selection'

/** What an undo or redo puts back: the sheet and the selection that went with the change. */
export interface SheetHistoryView {
  /** The sheet's key (`id`, or its name), so it is found again after sheets move. */
  sheet: string
  selection: SheetSelection
}

interface Entry {
  steps: SheetStep[]
  inverse: SheetStep[]
  group?: string
  time: number
  before: SheetHistoryView
  after: SheetHistoryView
}

/** Transactions in one group merge when they come within this many ms. */
const GROUP_WINDOW = 1000

export class SheetHistory {
  private done: Entry[] = []
  private undone: Entry[] = []

  constructor(private depth = 100) {}

  get canUndo() {
    return this.done.length > 0
  }

  get canRedo() {
    return this.undone.length > 0
  }

  record(
    tr: SheetTransaction,
    before: SheetHistoryView,
    after: SheetHistoryView,
    now = Date.now(),
  ) {
    if (!tr.changed || tr.meta.history === false) return
    this.undone = []
    const last = this.done[this.done.length - 1]
    const group = tr.meta.group
    if (last && group && last.group === group && now - last.time < GROUP_WINDOW) {
      last.steps = compactSheetSteps([...last.steps, ...tr.steps])
      last.inverse = compactSheetSteps([...tr.inverse, ...last.inverse])
      last.time = now
      last.after = after
      return
    }
    this.done.push({
      steps: tr.steps.slice(),
      inverse: tr.inverse.slice(),
      group,
      time: now,
      before,
      after,
    })
    if (this.done.length > this.depth) this.done.shift()
  }

  undo(doc: SheetWorkbook) {
    const entry = this.done.pop()
    if (!entry) return null
    this.undone.push(entry)
    return { tr: applySheetSteps(doc, entry.inverse), view: entry.before }
  }

  redo(doc: SheetWorkbook) {
    const entry = this.undone.pop()
    if (!entry) return null
    this.done.push({ ...entry, group: undefined })
    return { tr: applySheetSteps(doc, entry.steps), view: entry.after }
  }

  clear() {
    this.done = []
    this.undone = []
  }
}
