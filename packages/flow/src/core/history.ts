import type { FlowDocument, FlowSelection } from './model'
import { applySteps, compactSteps, type FlowStep, type Transaction } from './transaction'

interface Entry {
  steps: FlowStep[]
  inverse: FlowStep[]
  group?: string
  time: number
  selectionBefore: FlowSelection
  selectionAfter: FlowSelection
}

/** Transactions in one group merge when they come within this many ms. */
const GROUP_WINDOW = 1000

export class FlowHistory {
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
    tr: Transaction,
    selectionBefore: FlowSelection,
    selectionAfter: FlowSelection,
    now = Date.now(),
  ) {
    if (!tr.changed || tr.meta.history === false) return
    this.undone = []
    const last = this.done[this.done.length - 1]
    const group = tr.meta.group
    if (last && group && last.group === group && now - last.time < GROUP_WINDOW) {
      last.steps = compactSteps([...last.steps, ...tr.steps])
      last.inverse = compactSteps([...tr.inverse, ...last.inverse])
      last.time = now
      last.selectionAfter = selectionAfter
      return
    }
    this.done.push({
      steps: tr.steps.slice(),
      inverse: tr.inverse.slice(),
      group,
      time: now,
      selectionBefore,
      selectionAfter,
    })
    if (this.done.length > this.depth) this.done.shift()
  }

  /** Ends the current group, so the next change starts a new undo step. */
  close() {
    const last = this.done[this.done.length - 1]
    if (last) last.group = undefined
  }

  /** Forgets the last entry if it belongs to `group`, e.g. after a cancelled drag. */
  drop(group: string) {
    const last = this.done[this.done.length - 1]
    if (last?.group === group) this.done.pop()
  }

  undo(doc: FlowDocument) {
    const entry = this.done.pop()
    if (!entry) return null
    const tr = applySteps(doc, entry.inverse)
    this.undone.push(entry)
    return { tr, selection: entry.selectionBefore }
  }

  redo(doc: FlowDocument) {
    const entry = this.undone.pop()
    if (!entry) return null
    const tr = applySteps(doc, entry.steps)
    this.done.push({ ...entry, group: undefined })
    return { tr, selection: entry.selectionAfter }
  }

  clear() {
    this.done = []
    this.undone = []
  }
}
