import { applySteps } from './transaction'
import type { DashboardStep, DashboardTransaction } from './transaction'
import type { DashboardDocument, DashboardWidget } from './types'

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

  /**
   * Gives a change kept out of undo to the widget as undo and redo bring it
   * back, too: comments started on a widget stay on it when its adding is
   * undone and redone.
   */
  carry(id: string, patch: Partial<DashboardWidget>) {
    const fix = (steps: DashboardStep[]) =>
      steps.map((step) =>
        step.type === 'add' && step.widget.id === id
          ? { ...step, widget: withPatch(step.widget, patch) }
          : step,
      )
    for (const entry of [...this.done, ...this.undone]) {
      entry.steps = fix(entry.steps)
      entry.inverse = fix(entry.inverse)
    }
  }

  clear() {
    this.done = []
    this.undone = []
  }
}

function withPatch(widget: DashboardWidget, patch: Partial<DashboardWidget>): DashboardWidget {
  const next = { ...widget, ...patch }
  for (const [key, value] of Object.entries(patch))
    if (value === undefined) delete (next as Record<string, unknown>)[key]
  return next
}
