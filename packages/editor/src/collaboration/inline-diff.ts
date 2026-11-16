// Exact Myers diff with a shared operation budget. A rendering diff may
// approximate a difficult edit; a collaborative write must never do so.
/** A changed range by index: `a[aFrom..aTo)` became `b[bFrom..bTo)`. */
type Change = [aFrom: number, aTo: number, bFrom: number, bTo: number]
export interface DiffBudget {
  left: number
}
export const createDiffBudget = (): DiffBudget => ({ left: 8_000_000 })
const failed = () =>
  new Error(
    '[@dou-ui/editor] updateMap cannot safely merge this text within its comparison limit. Write a smaller change, or read the current document and reapply the change before retrying; the shared document has not been changed.',
  )
function spend(budget: DiffBudget) {
  if (--budget.left < 0) throw failed()
}

/**
 * The middle of the shortest edit path from `a[aLo..aHi)` to `b[bLo..bHi)`,
 * found from both ends at once (Myers, linear space), or `null` when the
 * two share nothing. All regions use the same operation budget.
 */
function bisect(
  a: ArrayLike<unknown>,
  aLo: number,
  aHi: number,
  b: ArrayLike<unknown>,
  bLo: number,
  bHi: number,
  budget: DiffBudget,
): [number, number] | null {
  const n = aHi - aLo
  const m = bHi - bLo
  const maxD = Math.ceil((n + m) / 2)
  const offset = maxD + 1
  const size = 2 * offset + 1
  const v1 = new Int32Array(size).fill(-1)
  const v2 = new Int32Array(size).fill(-1)
  v1[offset + 1] = 0
  v2[offset + 1] = 0
  const delta = n - m
  // With an odd difference the paths meet on a forward step, else on a reverse one.
  const front = (delta & 1) !== 0
  let k1start = 0
  let k1end = 0
  let k2start = 0
  let k2end = 0
  for (let d = 0; d < maxD; d++) {
    for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      spend(budget)
      const i = offset + k1
      let x1 = k1 === -d || (k1 !== d && v1[i - 1]! < v1[i + 1]!) ? v1[i + 1]! : v1[i - 1]! + 1
      let y1 = x1 - k1
      while (x1 < n && y1 < m && a[aLo + x1] === b[bLo + y1]) {
        spend(budget)
        x1++
        y1++
      }
      v1[i] = x1
      if (x1 > n) k1end += 2
      else if (y1 > m) k1start += 2
      else if (front) {
        const j = offset + delta - k1
        if (j >= 0 && j < size && v2[j] !== -1 && x1 >= n - v2[j]!) return [x1, y1]
      }
    }
    for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      spend(budget)
      const i = offset + k2
      let x2 = k2 === -d || (k2 !== d && v2[i - 1]! < v2[i + 1]!) ? v2[i + 1]! : v2[i - 1]! + 1
      let y2 = x2 - k2
      while (x2 < n && y2 < m && a[aHi - x2 - 1] === b[bHi - y2 - 1]) {
        spend(budget)
        x2++
        y2++
      }
      v2[i] = x2
      if (x2 > n) k2end += 2
      else if (y2 > m) k2start += 2
      else if (!front) {
        const j = offset + delta - k2
        if (j >= 0 && j < size && v1[j] !== -1) {
          const x1 = v1[j]!
          const y1 = x1 - (j - offset)
          if (x1 >= n - x2) return [x1, y1]
        }
      }
    }
  }
  return null
}

/** The changes from `a[aLo..aHi)` to `b[bLo..bHi)`, in order, pushed to `out`. */
function diffRange(
  a: ArrayLike<unknown>,
  aLo: number,
  aHi: number,
  b: ArrayLike<unknown>,
  bLo: number,
  bHi: number,
  budget: DiffBudget,
  out: Change[],
  depth = 0,
) {
  if (depth > 256) throw failed()
  while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) {
    spend(budget)
    aLo++
    bLo++
  }
  while (aLo < aHi && bLo < bHi && a[aHi - 1] === b[bHi - 1]) {
    spend(budget)
    aHi--
    bHi--
  }
  if (aLo === aHi && bLo === bHi) return
  if (aLo === aHi || bLo === bHi) {
    out.push([aLo, aHi, bLo, bHi])
    return
  }
  // Entirely different alphabets need no edit-path search. This is an
  // exact replacement, including for very long generated text.
  const seen = new Set<unknown>()
  for (let i = aLo; i < aHi; i++) {
    spend(budget)
    seen.add(a[i])
  }
  let common = false
  for (let i = bLo; i < bHi; i++) {
    spend(budget)
    if (seen.has(b[i])) {
      common = true
      break
    }
  }
  if (!common) {
    out.push([aLo, aHi, bLo, bHi])
    return
  }
  const split = bisect(a, aLo, aHi, b, bLo, bHi, budget)
  if (!split || (!split[0] && !split[1]) || (split[0] === aHi - aLo && split[1] === bHi - bLo))
    throw failed()
  diffRange(a, aLo, aLo + split[0], b, bLo, bLo + split[1], budget, out, depth + 1)
  diffRange(a, aLo + split[0], aHi, b, bLo + split[1], bHi, budget, out, depth + 1)
}

/** The changes between two lists, items compared with `===`, with touching ones joined. */
export function diffLists(
  a: ArrayLike<unknown>,
  b: ArrayLike<unknown>,
  budget = createDiffBudget(),
): Change[] {
  const raw: Change[] = []
  diffRange(a, 0, a.length, b, 0, b.length, budget, raw)
  const out: Change[] = []
  for (const change of raw) {
    const last = out[out.length - 1]
    if (last && last[1] === change[0] && last[3] === change[2]) {
      last[1] = change[1]
      last[3] = change[3]
    } else out.push(change)
  }
  return out
}
