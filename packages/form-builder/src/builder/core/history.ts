import type { FormDocument } from '../../core/types'
import { applyFormSteps, compactFormSteps } from './transaction'
import type { FormBuilderStep, FormBuilderTransaction } from './transaction'

interface Entry {
  steps: FormBuilderStep[]
  inverse: FormBuilderStep[]
  group?: string
  time: number
  selectionBefore: string[]
  selectionAfter: string[]
}

/** Transactions of one group merge when they come within this many ms. */
const GROUP_WINDOW = 1000

/** Undo and redo of a builder: the steps of each transaction and the selection around it. */
export class FormBuilderHistory {
  private done: Entry[] = []
  private undone: Entry[] = []

  constructor(private depth = 200) {}

  get canUndo() {
    return this.done.length > 0
  }

  get canRedo() {
    return this.undone.length > 0
  }

  record(
    tr: FormBuilderTransaction,
    selectionBefore: string[],
    selectionAfter: string[],
    now = Date.now(),
  ) {
    if (!tr.changed || tr.meta.history === false) return
    this.undone = []
    const last = this.done[this.done.length - 1]
    const group = tr.meta.group
    if (last && group && last.group === group && now - last.time < GROUP_WINDOW) {
      last.steps = compactFormSteps([...last.steps, ...tr.steps])
      last.inverse = compactFormSteps([...tr.inverse, ...last.inverse])
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

  /** End the current group, so the next change starts a new undo step. */
  close() {
    const last = this.done[this.done.length - 1]
    if (last) last.group = undefined
  }

  undo(document: FormDocument) {
    const entry = this.done.pop()
    if (!entry) return null
    const tr = applyFormSteps(document, entry.inverse)
    this.undone.push(entry)
    return { tr, selection: entry.selectionBefore }
  }

  redo(document: FormDocument) {
    const entry = this.undone.pop()
    if (!entry) return null
    const tr = applyFormSteps(document, entry.steps)
    this.done.push({ ...entry, group: undefined })
    return { tr, selection: entry.selectionAfter }
  }

  clear() {
    this.done = []
    this.undone = []
  }
}
