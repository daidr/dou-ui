// Bounded Myers diff, as used by the code diff viewer. Kept here so collaboration
// does not require the optional code package at runtime.
/** A changed range by index: `a[aFrom..aTo)` became `b[bFrom..bTo)`. */
type Change = [aFrom: number, aTo: number, bFrom: number, bTo: number]

/**
 * The middle of the shortest edit path from `a[aLo..aHi)` to `b[bLo..bHi)`,
 * found from both ends at once (Myers, linear space), or `null` when the
 * two share nothing or it costs more than `maxCost` steps.
 */
function bisect(
  a: ArrayLike<unknown>,
  aLo: number,
  aHi: number,
  b: ArrayLike<unknown>,
  bLo: number,
  bHi: number,
  maxCost: number,
): [number, number] | null {
  const n = aHi - aLo
  const m = bHi - bLo
  const maxD = Math.min(Math.ceil((n + m) / 2), maxCost)
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
      const i = offset + k1
      let x1 = k1 === -d || (k1 !== d && v1[i - 1]! < v1[i + 1]!) ? v1[i + 1]! : v1[i - 1]! + 1
      let y1 = x1 - k1
      while (x1 < n && y1 < m && a[aLo + x1] === b[bLo + y1]) {
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
      const i = offset + k2
      let x2 = k2 === -d || (k2 !== d && v2[i - 1]! < v2[i + 1]!) ? v2[i + 1]! : v2[i - 1]! + 1
      let y2 = x2 - k2
      while (x2 < n && y2 < m && a[aHi - x2 - 1] === b[bHi - y2 - 1]) {
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
  maxCost: number,
  out: Change[],
) {
  while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) {
    aLo++
    bLo++
  }
  while (aLo < aHi && bLo < bHi && a[aHi - 1] === b[bHi - 1]) {
    aHi--
    bHi--
  }
  if (aLo === aHi && bLo === bHi) return
  if (aLo === aHi || bLo === bHi) {
    out.push([aLo, aHi, bLo, bHi])
    return
  }
  const split = bisect(a, aLo, aHi, b, bLo, bHi, maxCost)
  if (!split) {
    out.push([aLo, aHi, bLo, bHi])
    return
  }
  diffRange(a, aLo, aLo + split[0], b, bLo, bLo + split[1], maxCost, out)
  diffRange(a, aLo + split[0], aHi, b, bLo + split[1], bHi, maxCost, out)
}

/** The changes between two lists, items compared with `===`, with touching ones joined. */
export function diffLists(a: ArrayLike<unknown>, b: ArrayLike<unknown>, maxCost: number): Change[] {
  const raw: Change[] = []
  diffRange(a, 0, a.length, b, 0, b.length, maxCost, raw)
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
