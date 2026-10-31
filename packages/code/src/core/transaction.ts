import { ChangeSet, type CodeChangeSpec } from './changes'
import {
  type CodeRange,
  type CodeSelection,
  mapSelection,
  normalizeSelection,
  rangeFrom,
  rangeTo,
  selectionOf,
} from './selection'
import type { CodeText } from './text'

/** Where a transaction came from. Undo groups typing and deleting by it. */
export type CodeAction =
  | 'input'
  | 'delete'
  | 'paste'
  | 'cut'
  | 'drop'
  | 'indent'
  | 'select'
  | 'undo'
  | 'redo'
  | 'external'
  | (string & {})

export interface CodeTransactionMeta {
  /** What made the change, e.g. `'input'` for typing, `'external'` for a new `v-model` value. */
  action?: CodeAction
  /** `false` keeps the change out of undo. */
  history?: boolean
  /** Scroll the main cursor into view afterwards; on by default for edits. */
  scroll?: boolean
  [key: string]: unknown
}

/** The editor's content: the text and what is selected in it. */
export interface CodeState {
  readonly doc: CodeText
  readonly selection: CodeSelection
}

/**
 * One step from a state to the next. Every position given to it is in the
 * text as it was when the transaction started, also after earlier calls in
 * the same transaction; changes may not overlap.
 *
 * Without `select()`, the selection moves along with the changes.
 */
export class CodeTransaction {
  private specs: CodeChangeSpec[] = []
  private nextSelection: CodeSelection | null = null
  readonly meta: CodeTransactionMeta = {}

  constructor(readonly start: CodeState) {}

  get doc(): CodeText {
    return this.start.doc
  }

  get selection(): CodeSelection {
    return this.start.selection
  }

  /** Replaces `from`–`to` with `insert`. */
  replace(from: number, to: number, insert: string): this {
    this.specs.push({ from, to, insert })
    return this
  }

  insert(pos: number, text: string): this {
    return this.replace(pos, pos, text)
  }

  delete(from: number, to: number): this {
    return this.replace(from, to, '')
  }

  /** Sets the selection after the step, in the text after the step. */
  select(selection: CodeSelection | number, head?: number): this {
    this.nextSelection = typeof selection === 'number' ? selectionOf(selection, head) : selection
    return this
  }

  /**
   * Replaces every selected range with `text` (or what `text` returns for
   * it) and leaves a cursor after each insertion.
   */
  replaceSelection(text: string | ((range: CodeRange, index: number) => string)): this {
    const ranges = this.start.selection.ranges
    let shift = 0
    const cursors: CodeRange[] = []
    ranges.forEach((range, i) => {
      const insert = typeof text === 'string' ? text : text(range, i)
      const from = rangeFrom(range)
      const to = rangeTo(range)
      this.replace(from, to, insert)
      const pos = from + shift + insert.replace(/\r\n?/g, '\n').length
      cursors.push({ anchor: pos, head: pos })
      shift += insert.replace(/\r\n?/g, '\n').length - (to - from)
    })
    return this.select({ ranges: cursors, main: this.start.selection.main })
  }

  setMeta(meta: CodeTransactionMeta): this {
    Object.assign(this.meta, meta)
    return this
  }

  /** Whether the transaction changes the text. */
  get docChanged(): boolean {
    return this.specs.length > 0
  }

  /** The changes, the new state, and the selection before. */
  resolve(): CodeTransactionResult {
    const changes = ChangeSet.of(this.specs, this.start.doc.length)
    const doc = changes.empty ? this.start.doc : changes.apply(this.start.doc)
    const selection = normalizeSelection(
      this.nextSelection ?? mapSelection(this.start.selection, changes),
      doc.length,
    )
    return { changes, state: { doc, selection }, before: this.start, meta: this.meta }
  }
}

/** What a transaction did, as handed to `change` listeners. */
export interface CodeTransactionResult {
  readonly changes: ChangeSet
  readonly state: CodeState
  readonly before: CodeState
  readonly meta: CodeTransactionMeta
}
