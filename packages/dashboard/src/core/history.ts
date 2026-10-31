import { applySteps } from './transaction'
import type { DashboardStep, DashboardTransaction } from './transaction'
import type { DashboardDocument } from './types'

interface Entry {
  steps: DashboardStep[]
  inverse: DashboardStep[]
  group?: string
  time: number
}

/** Transactions of one group merge when they come within this many ms. */
const GROUP_WINDOW = 1000

/** Undo and redo of a dashboard: the steps of each transaction and the steps that undo them. */
export class DashboardHistory {
  private done: Entry[] = []
  private undone: Entry[] = []

  constructor(private depth = 200) {}

  get canUndo() {
    return this.done.length > 0
  }

  get canRedo() {
    return this.undone.length > 0
  }

  record(tr: DashboardTransaction, now = Date.now()) {
    if (!tr.changed || tr.meta.history === false) return
    this.undone = []
    const last = this.done[this.done.length - 1]
    const group = tr.meta.group
    if (last && group && last.group === group && now - last.time < GROUP_WINDOW) {
      last.steps = [...last.steps, ...tr.steps]
      last.inverse = [...tr.inverse, ...last.inverse]
      last.time = now
      return
    }
    this.done.push({ steps: tr.steps.slice(), inverse: tr.inverse.slice(), group, time: now })
    if (this.done.length > this.depth) this.done.shift()
  }

  undo(document: DashboardDocument) {
    const entry = this.done.pop()
    if (!entry) return null
    this.undone.push(entry)
    return applySteps(document, entry.inverse, { history: false, origin: 'undo' })
  }

  redo(document: DashboardDocument) {
    const entry = this.undone.pop()
    if (!entry) return null
    this.done.push({ ...entry, group: undefined })
    return applySteps(document, entry.steps, { history: false, origin: 'redo' })
  }

  clear() {
    this.done = []
    this.undone = []
  }
}
