/**
 * Order keys: strings that sort like the blocks they belong to. A key can
 * always be made between two others, so moving or inserting a block only
 * writes that block's key, never its neighbours'.
 */

// ascending in code-unit order, so plain `<` compares keys
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** A key between `a` and `b` (`b === null` means no upper bound). Keys never end in `0`. */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0
    while ((a[n] ?? '0') === b[n]) n++
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }
  const low = a ? DIGITS.indexOf(a[0]!) : 0
  const high = b !== null ? DIGITS.indexOf(b[0]!) : DIGITS.length
  if (high - low > 1) return DIGITS[Math.round((low + high) / 2)]!
  if (b !== null && b.length > 1) return b.slice(0, 1)
  return DIGITS[low]! + midpoint(a.slice(1), null)
}

/** A key after `a` and before `b`; either may be missing. Needs `a < b`. */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b)
    throw new Error(`[@dou-ui/editor] bad order keys ${a} ${b}`)
  return midpoint(a ?? '', b)
}

/** `n` keys in order between `a` and `b`, kept short by splitting the range in halves. */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return []
  const middle = keyBetween(a, b)
  const left = Math.floor((n - 1) / 2)
  return [...keysBetween(a, middle, left), middle, ...keysBetween(middle, b, n - 1 - left)]
}

/**
 * Which of `keys` (in their wanted order) can stay: the longest strictly
 * increasing run. Missing keys (`null`) never stay. Returns the indexes.
 */
export function keptIndexes(keys: (string | null)[]): Set<number> {
  // patience sorting with back links
  const tails: number[] = []
  const previous: number[] = []
  keys.forEach((key, index) => {
    if (key === null) return
    let low = 0
    let high = tails.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (keys[tails[mid]!]! < key) low = mid + 1
      else high = mid
    }
    previous[index] = low > 0 ? tails[low - 1]! : -1
    tails[low] = index
  })
  const kept = new Set<number>()
  let index = tails.length ? tails[tails.length - 1]! : -1
  while (index >= 0) {
    kept.add(index)
    index = previous[index]!
  }
  return kept
}

/**
 * Order keys for items in their wanted order, given each one's current key
 * (`null` when it has none). The longest run already in order keeps its
 * keys; the others get fresh keys between their kept neighbours.
 */
export function orderKeys(keys: (string | null)[]): string[] {
  const kept = keptIndexes(keys)
  const result = keys.slice()
  let i = 0
  while (i < result.length) {
    if (kept.has(i)) {
      i++
      continue
    }
    let j = i
    while (j < result.length && !kept.has(j)) j++
    const fresh = keysBetween(
      i > 0 ? result[i - 1]! : null,
      j < result.length ? result[j]! : null,
      j - i,
    )
    for (let k = i; k < j; k++) result[k] = fresh[k - i]!
    i = j
  }
  return result as string[]
}

/**
 * Keys only for items inserted or moved between base and written. Other
 * surviving items retain the room's order, including its new items.
 */
export function changedOrderKeys(
  before: string[],
  after: string[],
  current: Map<string, string | null>,
  compareIds?: (a: string, b: string) => number,
): Map<string, string> {
  const old = new Map(before.map((id, index) => [id, String(index).padStart(12, '0')]))
  const stays = keptIndexes(after.map((id) => old.get(id) ?? null))
  const moved = new Set(after.filter((id, index) => current.has(id) && !stays.has(index)))
  if (!moved.size) return new Map()
  const ordered = [...current.keys()].filter((id) => !moved.has(id))
  ordered.sort((a, b) => {
    const left = current.get(a) ?? ''
    const right = current.get(b) ?? ''
    return left === right
      ? compareIds
        ? compareIds(a, b)
        : a < b
          ? -1
          : a > b
            ? 1
            : 0
      : left < right
        ? -1
        : 1
  })
  // Linked neighbours avoid repeated scans/splices when many items move.
  const links = new Map<string, { previous: string | null; next: string | null }>()
  let head = ordered[0] ?? null
  ordered.forEach((id, index) =>
    links.set(id, { previous: ordered[index - 1] ?? null, next: ordered[index + 1] ?? null }),
  )
  let previous: string | null = null
  for (const id of after) {
    if (moved.has(id)) {
      const next = previous === null ? head : links.get(previous)!.next
      links.set(id, { previous, next })
      if (previous === null) head = id
      else links.get(previous)!.next = id
      if (next !== null) links.get(next)!.previous = id
    }
    if (links.has(id)) previous = id
  }
  const result: string[] = []
  for (let id = head; id !== null; id = links.get(id)!.next) result.push(id)
  const keys = result.map((id) => (moved.has(id) ? null : (current.get(id) ?? null)))
  const next = orderKeys(keys)
  return new Map(
    result.flatMap((id, index) =>
      current.get(id) !== next[index] ? [[id, next[index]!] as const] : [],
    ),
  )
}
