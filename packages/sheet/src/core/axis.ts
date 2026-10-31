/**
 * Where each row (or column) starts, for a list of rows that share one
 * size except for a few. Offsets are summed once, so finding a row's place
 * and the row at a place are a lookup and a binary search.
 */
export class SheetAxis {
  /** `offsets[i]` is where item `i` starts; the last entry is the total. */
  private offsets: Float64Array

  constructor(
    readonly count: number,
    readonly base: number,
    readonly sizes: Readonly<Record<number, number>> = {},
  ) {
    const offsets = new Float64Array(count + 1)
    let changed = false
    for (const key in sizes) {
      if (Number(key) < count) {
        changed = true
        break
      }
    }
    if (!changed) {
      for (let i = 0; i <= count; i++) offsets[i] = i * base
    } else {
      let at = 0
      for (let i = 0; i < count; i++) {
        offsets[i] = at
        at += sizes[i] ?? base
      }
      offsets[count] = at
    }
    this.offsets = offsets
  }

  get total() {
    return this.offsets[this.count]!
  }

  /** Where item `index` starts; past the end, the total. */
  offset(index: number) {
    return this.offsets[Math.max(0, Math.min(this.count, index))]!
  }

  size(index: number) {
    return this.offset(index + 1) - this.offset(index)
  }

  /** Whether item `index` is hidden (its size is 0). */
  hidden(index: number) {
    return this.size(index) === 0
  }

  /** The item at `px`, clamped to the first and last; hidden items are skipped. */
  indexAt(px: number) {
    const { offsets, count } = this
    if (count === 0) return 0
    if (px <= 0) return this.visibleFrom(0, 1)
    if (px >= this.total) return this.visibleFrom(count - 1, -1)
    let low = 0
    let high = count - 1
    // the last item that starts at or before px
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (offsets[mid]! <= px) low = mid
      else high = mid - 1
    }
    return this.visibleFrom(low, -1)
  }

  /** The first item from `index` on (going by `step`) that is not hidden; `index` when all are. */
  visibleFrom(index: number, step: 1 | -1) {
    for (let i = index; i >= 0 && i < this.count; i += step) if (!this.hidden(i)) return i
    for (let i = index; i >= 0 && i < this.count; i -= step) if (!this.hidden(i)) return i
    return index
  }
}
