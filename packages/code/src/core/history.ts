import type { ChangeSet } from './changes'
import { type CodeSelection, sameSelection } from './selection'
import type { CodeTransactionResult } from './transaction'

/** Typing and deleting closer together than this is undone in one go. */
const GROUP_MS = 500
const LIMIT = 500

interface Entry {
  changes: ChangeSet
  inverse: ChangeSet
  /** The selection before and after, restored by undo and redo. */
  before: CodeSelection
  after: CodeSelection
  action: string | undefined
  time: number
}

const GROUPED = new Set(['input', 'delete'])

/** Undo and redo stacks. Selection-only steps aren't kept; each entry remembers the selection around it. */
export class CodeHistory {
  private done: Entry[] = []
  private undone: Entry[] = []

  get canUndo() {
    return this.done.length > 0
  }

  get canRedo() {
    return this.undone.length > 0
  }

  /** Remembers a transaction that changed the text. */
  record(result: CodeTransactionResult, time = Date.now()) {
    const { changes, before, state, meta } = result
    if (changes.empty || meta.history === false) return
    const inverse = changes.invert(before.doc)
    const last = this.done[this.done.length - 1]
    this.undone = []
    // Keep typing in one entry while the cursor hasn't moved in between.
    if (
      last &&
      meta.action &&
      GROUPED.has(meta.action) &&
      last.action === meta.action &&
      time - last.time < GROUP_MS &&
      sameSelection(last.after, before.selection)
    ) {
      last.changes = last.changes.compose(changes)
      last.inverse = inverse.compose(last.inverse)
      last.after = state.selection
      last.time = time
      return
    }
    this.done.push({
      changes,
      inverse,
      before: before.selection,
      after: state.selection,
      action: meta.action,
      time,
    })
    if (this.done.length > LIMIT) this.done.shift()
  }

  /** Starts a new entry with the next change, even if it would join the last one. */
  close() {
    const last = this.done[this.done.length - 1]
    if (last) last.time = -Infinity
  }

  /** Takes the last entry off: the changes that undo it and the selection to go back to. */
  undo(): { changes: ChangeSet; selection: CodeSelection } | null {
    const entry = this.done.pop()
    if (!entry) return null
    this.undone.push(entry)
    this.close()
    return { changes: entry.inverse, selection: entry.before }
  }

  redo(): { changes: ChangeSet; selection: CodeSelection } | null {
    const entry = this.undone.pop()
    if (!entry) return null
    entry.time = -Infinity
    this.done.push(entry)
    return { changes: entry.changes, selection: entry.after }
  }

  clear() {
    this.done = []
    this.undone = []
  }
}
