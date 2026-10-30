import {
  applySteps,
  compactSteps,
  type GanttDocument,
  type GanttStep,
  type GanttTransaction,
} from './transaction'

interface Entry {
  steps: GanttStep[]
  inverse: GanttStep[]
  group?: string
  time: number
  selectionBefore: string[]
  selectionAfter: string[]
}

/** Transactions in one group merge when they come within this many ms. */
const GROUP_WINDOW = 1000

export class GanttHistory {
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
    tr: GanttTransaction,
    selectionBefore: string[],
    selectionAfter: string[],
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

  undo(doc: GanttDocument) {
    const entry = this.done.pop()
    if (!entry) return null
    const tr = applySteps(doc, entry.inverse)
    this.undone.push(entry)
    return { tr, selection: entry.selectionBefore }
  }

  redo(doc: GanttDocument) {
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
