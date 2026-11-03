import type { CodeText } from './text'

/** Replace `from`–`to` of the old text with `insert`. */
export interface CodeChange {
  from: number
  to: number
  insert: string
}

/** A change as written by hand: `to` defaults to `from`, `insert` to nothing. */
export interface CodeChangeSpec {
  from: number
  to?: number
  insert?: string
}

/** Which side of an insertion at the very spot a position ends up on. */
export type MapAssoc = -1 | 1

type Op = { retain: number } | { delete: number } | { insert: string }

/**
 * The changes one step makes to a text: replacements sorted by position,
 * never overlapping, every offset counted in the text before the step.
 *
 * A change set maps positions from the old text to the new one (cursors,
 * marks, diagnostics follow the edit), inverts (undo), and composes with the
 * one after it (merging steps).
 */
export class ChangeSet {
  /** Running length difference after each change, for mapping by binary search. */
  private shifts?: number[]

  private constructor(
    /** The replacements, sorted. */
    readonly changes: readonly CodeChange[],
    /** Length of the text the changes apply to. */
    readonly length: number,
  ) {}

  /**
   * Changes to a text of `length`. Specs may come in any order; touching
   * ones are joined, overlapping ones are a mistake.
   */
  static of(specs: CodeChangeSpec | readonly CodeChangeSpec[], length: number): ChangeSet {
    const list = (Array.isArray(specs) ? specs : [specs]) as readonly CodeChangeSpec[]
    const sorted = list
      .map((spec) => ({ from: spec.from, to: spec.to ?? spec.from, insert: spec.insert ?? '' }))
      .filter((change) => change.from !== change.to || change.insert)
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
      .sort((a, b) => a.from - b.from || a.to - b.to)
    const changes: CodeChange[] = []
    for (const change of sorted) {
      if (change.from < 0 || change.to > length || change.from > change.to)
        throw new RangeError(
          `[@dou-ui/code] change ${change.from}–${change.to} is outside 0–${length}`,
        )
      const last = changes[changes.length - 1]
      if (last && change.from < last.to)
        throw new RangeError(
          `[@dou-ui/code] changes ${last.from}–${last.to} and ${change.from}–${change.to} overlap`,
        )
      // Normalize line breaks, so the text never holds a `\r`.
      if (change.insert.includes('\r')) change.insert = change.insert.replace(/\r\n?/g, '\n')
      if (last && change.from === last.to) {
        last.to = change.to
        last.insert += change.insert
      } else changes.push(change)
    }
    return new ChangeSet(changes, length)
  }

  /** No changes at all. */
  static empty(length: number): ChangeSet {
    return new ChangeSet([], length)
  }

  get empty(): boolean {
    return this.changes.length === 0
  }

  /** Length of the text after the changes. */
  get newLength(): number {
    let length = this.length
    for (const change of this.changes) length += change.insert.length - (change.to - change.from)
    return length
  }

  /** Applies the changes to `text`, which must be the text they were made for. */
  apply(text: CodeText): CodeText {
    if (text.length !== this.length)
      throw new RangeError(
        `[@dou-ui/code] changes for a text of ${this.length} applied to one of ${text.length}`,
      )
    // From the end, so earlier offsets stay right.
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const change = this.changes[i]!
      text = text.replace(change.from, change.to, change.insert)
    }
    return text
  }

  /** The changes that undo these, given the text before them. */
  invert(text: CodeText): ChangeSet {
    let shift = 0
    const out: CodeChange[] = []
    for (const change of this.changes) {
      const from = change.from + shift
      out.push({
        from,
        to: from + change.insert.length,
        insert: text.slice(change.from, change.to),
      })
      shift += change.insert.length - (change.to - change.from)
    }
    return new ChangeSet(out, this.newLength)
  }

  /** Where `pos` in the old text is in the new one. */
  mapPos(pos: number, assoc: MapAssoc = -1): number {
    const changes = this.changes
    if (!changes.length) return pos
    if (!this.shifts) {
      let shift = 0
      this.shifts = changes.map(
        (change) => (shift += change.insert.length - (change.to - change.from)),
      )
    }
    // The last change that starts at or before `pos`.
    let lo = 0
    let hi = changes.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (changes[mid]!.from <= pos) {
        found = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    if (found < 0) return pos
    const change = changes[found]!
    const before = found ? this.shifts[found - 1]! : 0
    if (pos > change.to) return pos + this.shifts[found]!
    const start = change.from + before
    const end = start + change.insert.length
    if (pos === change.from && change.from === change.to) return assoc < 0 ? start : end
    if (pos === change.from) return start
    if (pos === change.to) return end
    return assoc < 0 ? start : end
  }

  /** Whether any change touches `from`–`to` of the old text. */
  touches(from: number, to = from): boolean {
    return this.changes.some((change) => change.from <= to && change.to >= from)
  }

  /** These changes followed by `next`, which was made for the text these produce. */
  compose(next: ChangeSet): ChangeSet {
    if (next.length !== this.newLength)
      throw new RangeError(
        `[@dou-ui/code] composing changes for ${next.length} after ones that make ${this.newLength}`,
      )
    const a = toOps(this)
    const b = toOps(next)
    const out: Op[] = []
    let i = 0
    let j = 0
    let opA: Op | undefined = a[i++]
    let opB: Op | undefined = b[j++]
    while (opA || opB) {
      if (opA && 'delete' in opA) {
        out.push(opA)
        opA = a[i++]
      } else if (opB && 'insert' in opB) {
        out.push(opB)
        opB = b[j++]
      } else if (opA && opB) {
        const sizeA = 'retain' in opA ? opA.retain : (opA as { insert: string }).insert.length
        const sizeB = 'retain' in opB ? opB.retain : (opB as { delete: number }).delete
        const n = Math.min(sizeA, sizeB)
        if ('retain' in opA) {
          out.push('retain' in opB ? { retain: n } : { delete: n })
        } else if ('retain' in opB) {
          out.push({ insert: opA.insert.slice(0, n) })
        }
        // An insert that `next` deletes again leaves nothing.
        opA = sizeA > n ? shrink(opA, n) : a[i++]
        opB = sizeB > n ? shrink(opB, n) : b[j++]
      } else {
        throw new RangeError('[@dou-ui/code] change sets of different lengths')
      }
    }
    return fromOps(out, this.length)
  }
}

function shrink(op: Op, n: number): Op {
  if ('retain' in op) return { retain: op.retain - n }
  if ('delete' in op) return { delete: op.delete - n }
  return { insert: op.insert.slice(n) }
}

function toOps(set: ChangeSet): Op[] {
  const ops: Op[] = []
  let pos = 0
  for (const change of set.changes) {
    if (change.from > pos) ops.push({ retain: change.from - pos })
    if (change.to > change.from) ops.push({ delete: change.to - change.from })
    if (change.insert) ops.push({ insert: change.insert })
    pos = change.to
  }
  if (set.length > pos) ops.push({ retain: set.length - pos })
  return ops
}

function fromOps(ops: readonly Op[], length: number): ChangeSet {
  const specs: CodeChange[] = []
  let pos = 0
  let open: CodeChange | null = null
  for (const op of ops) {
    if ('retain' in op) {
      if (!op.retain) continue
      open = null
      pos += op.retain
      continue
    }
    if (!open) {
      open = { from: pos, to: pos, insert: '' }
      specs.push(open)
    }
    if ('delete' in op) {
      open.to += op.delete
      pos += op.delete
    } else open.insert += op.insert
  }
  return ChangeSet.of(specs, length)
}
