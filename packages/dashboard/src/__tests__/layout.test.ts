import { describe, expect, it } from 'vitest'
import {
  compactLayout,
  deriveLayout,
  findPlace,
  fitItem,
  layoutHeight,
  moveItem,
  moveItemBy,
  normalizeLayout,
  overlaps,
  resizeItem,
  resizeItemBy,
} from '../layout'
import type { GridItem } from '../layout'

const opts = { columns: 12 } as const
const free = { columns: 12, compact: false } as const

const byId = (items: readonly GridItem[]) =>
  Object.fromEntries(items.map((item) => [item.id, [item.x, item.y, item.w, item.h]]))

function noOverlap(items: readonly GridItem[]) {
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (overlaps(items[i]!, items[j]!)) return `${items[i]!.id} / ${items[j]!.id}`
  return null
}

/** A seeded random layout with no overlaps. */
function randomLayout(seed: number, count: number, columns = 12): GridItem[] {
  let s = seed
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const items: GridItem[] = []
  while (items.length < count) {
    const w = 1 + Math.floor(rand() * 4)
    const h = 1 + Math.floor(rand() * 3)
    const item = {
      id: `i${items.length}`,
      x: Math.floor(rand() * (columns - w + 1)),
      y: Math.floor(rand() * count),
      w,
      h,
    }
    if (!items.some((other) => overlaps(other, item))) items.push(item)
  }
  return items
}

/** Compaction the slow way: each item, top down, rises one row at a time until it would touch something. */
function naiveCompact(items: GridItem[]) {
  const order = items.map((_, i) => i)
  order.sort((a, b) => items[a]!.y - items[b]!.y || items[a]!.x - items[b]!.x || a - b)
  const placed: GridItem[] = []
  const out = items.slice()
  for (const i of order) {
    const item = { ...items[i]! }
    while (item.y > 0 && !placed.some((p) => overlaps(p, { ...item, y: item.y - 1 }))) item.y--
    placed.push(item)
    out[i] = item
  }
  return out
}

describe('fitItem', () => {
  it('keeps an item that fits', () => {
    const item = { id: 'a', x: 2, y: 1, w: 3, h: 2 }
    expect(fitItem(item, 12)).toBe(item)
  })

  it('clamps size to limits and position to the grid', () => {
    expect(fitItem({ id: 'a', x: 10, y: -2, w: 5, h: 0, minH: 2 }, 12)).toMatchObject({
      x: 7,
      y: 0,
      w: 5,
      h: 2,
    })
    expect(fitItem({ id: 'a', x: 0, y: 0, w: 20, h: 9, maxH: 4 }, 12)).toMatchObject({
      w: 12,
      h: 4,
    })
    expect(fitItem({ id: 'a', x: 1.4, y: 2.6, w: 2.5, h: 1 }, 12)).toMatchObject({
      x: 1,
      y: 3,
      w: 3,
    })
  })
})

describe('compaction', () => {
  it('floats items up and keeps the objects of items that stay', () => {
    const a = { id: 'a', x: 0, y: 0, w: 4, h: 2 }
    const b = { id: 'b', x: 0, y: 5, w: 4, h: 2 }
    const c = { id: 'c', x: 4, y: 3, w: 2, h: 1 }
    const out = compactLayout([a, b, c], 12)
    expect(out[0]).toBe(a)
    expect(byId(out)).toEqual({ a: [0, 0, 4, 2], b: [0, 2, 4, 2], c: [4, 0, 2, 1] })
  })

  it('agrees with rising one row at a time', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const items = randomLayout(seed, 30)
      expect(byId(compactLayout(items, 12))).toEqual(byId(naiveCompact(items)))
    }
  })

  it('goes around locked items and fills the space above them', () => {
    const items = [
      { id: 'lock', x: 0, y: 2, w: 6, h: 2, locked: true },
      { id: 'a', x: 0, y: 6, w: 4, h: 3 },
      { id: 'b', x: 0, y: 9, w: 4, h: 1 },
    ]
    // a is too tall for the two rows above the lock; b fits there
    expect(byId(compactLayout(items, 12))).toEqual({
      lock: [0, 2, 6, 2],
      a: [0, 4, 4, 3],
      b: [0, 7, 4, 1],
    })
    const short = [items[0]!, { id: 'a', x: 0, y: 6, w: 4, h: 2 }]
    expect(byId(compactLayout(short, 12)).a).toEqual([0, 0, 4, 2])
  })

  it('returns the same array for a settled layout', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 6, y: 0, w: 6, h: 2 },
    ]
    expect(normalizeLayout(items, opts)).toBe(items)
  })

  it('pulls overlapping items apart', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 3, y: 1, w: 6, h: 2 },
    ]
    const out = normalizeLayout(items, opts)
    expect(noOverlap(out)).toBeNull()
    expect(byId(out).b).toEqual([3, 2, 6, 2])
    expect(byId(normalizeLayout(items, free)).b).toEqual([3, 2, 6, 2])
  })

  it('leaves gaps alone without compaction', () => {
    const items = [{ id: 'a', x: 0, y: 4, w: 6, h: 2 }]
    expect(normalizeLayout(items, free)).toBe(items)
  })
})

const row = () => [
  { id: 'a', x: 0, y: 0, w: 6, h: 2 },
  { id: 'b', x: 6, y: 0, w: 6, h: 2 },
  { id: 'c', x: 0, y: 2, w: 12, h: 2 },
]

describe('moving', () => {
  it('swaps places side by side', () => {
    const out = moveItem(row(), 'a', { x: 6, y: 0 }, opts)
    expect(byId(out)).toEqual({ a: [6, 0, 6, 2], b: [0, 0, 6, 2], c: [0, 2, 12, 2] })
    expect(noOverlap(out)).toBeNull()
  })

  it('moves up past the item above', () => {
    const out = moveItem(row(), 'c', { x: 0, y: 0 }, opts)
    expect(byId(out)).toEqual({ a: [0, 2, 6, 2], b: [6, 2, 6, 2], c: [0, 0, 12, 2] })
  })

  it('floats back up when dropped below everything', () => {
    const out = moveItem(row(), 'a', { x: 0, y: 30 }, opts)
    expect(byId(out)).toEqual({ a: [0, 4, 6, 2], b: [6, 0, 6, 2], c: [0, 2, 12, 2] })
  })

  it('stays where it is dropped without compaction', () => {
    const out = moveItem(row(), 'a', { x: 0, y: 9 }, free)
    expect(byId(out)).toEqual({ a: [0, 9, 6, 2], b: [6, 0, 6, 2], c: [0, 2, 12, 2] })
    const pushed = moveItem(row(), 'a', { x: 3, y: 1 }, free)
    expect(noOverlap(pushed)).toBeNull()
    expect(byId(pushed)).toEqual({ a: [3, 1, 6, 2], b: [6, 3, 6, 2], c: [0, 5, 12, 2] })
  })

  it('keeps the moved item inside the grid and off locked items', () => {
    const items = [...row(), { id: 'l', x: 6, y: 4, w: 6, h: 2, locked: true }]
    expect(byId(moveItem(items, 'a', { x: 99, y: 0 }, opts)).a).toEqual([6, 0, 6, 2])
    const out = moveItem(items, 'a', { x: 6, y: 4 }, free)
    expect(byId(out).a).toEqual([6, 6, 6, 2])
    expect(noOverlap(out)).toBeNull()
    expect(moveItem(items, 'l', { x: 0, y: 0 }, opts)).toBe(items)
    expect(moveItem(items, 'nope', { x: 0, y: 0 }, opts)).toBe(items)
  })

  it('never overlaps, whatever the move', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const items = compactLayout(randomLayout(seed, 24), 12)
      for (let k = 0; k < 10; k++) {
        const id = `i${(seed * 7 + k) % 24}`
        for (const options of [opts, free]) {
          const out = moveItem(items, id, { x: (k * 5) % 12, y: (k * 3) % 9 }, options)
          expect(noOverlap(out)).toBeNull()
          expect(out.map((item) => item.id)).toEqual(items.map((item) => item.id))
        }
      }
    }
  })

  it('is the same every time', () => {
    const items = compactLayout(randomLayout(3, 40), 12)
    const a = moveItem(items, 'i5', { x: 4, y: 2 }, opts)
    const b = moveItem(items, 'i5', { x: 4, y: 2 }, opts)
    expect(byId(a)).toEqual(byId(b))
  })
})

const stack = () => [
  { id: 'a', x: 0, y: 0, w: 6, h: 3 },
  { id: 'b', x: 0, y: 3, w: 6, h: 1 },
]

describe('keyboard moves', () => {
  it('moves down past the item below in one press', () => {
    const out = moveItemBy(stack(), 'a', 0, 1, opts)
    expect(byId(out)).toEqual({ a: [0, 1, 6, 3], b: [0, 0, 6, 1] })
    expect(byId(moveItemBy(out, 'a', 0, -1, opts))).toEqual(byId(stack()))
  })

  it('does nothing at the edges', () => {
    const items = stack()
    expect(moveItemBy(items, 'a', 0, -1, opts)).toBe(items)
    expect(byId(moveItemBy(items, 'b', 0, 1, opts))).toEqual(byId(items))
  })

  it('moves sideways one column', () => {
    expect(byId(moveItemBy(stack(), 'b', 1, 0, opts)).b).toEqual([1, 3, 6, 1])
  })

  it('resizes within limits', () => {
    const items = [{ id: 'a', x: 0, y: 0, w: 4, h: 2, maxW: 5, minH: 2 }, ...stack().slice(1)]
    expect(byId(resizeItemBy(items, 'a', 3, 0, opts)).a).toEqual([0, 0, 5, 2])
    expect(byId(resizeItemBy(items, 'a', 0, -1, opts)).a).toEqual([0, 0, 4, 2])
    const taller = resizeItemBy(items, 'a', 0, 2, opts)
    expect(byId(taller)).toEqual({ a: [0, 0, 4, 4], b: [0, 4, 6, 1] })
  })

  it('refuses to resize over a locked item', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'l', x: 4, y: 0, w: 4, h: 2, locked: true },
    ]
    expect(resizeItem(items, 'a', { w: 6, h: 2 }, opts)).toBe(items)
  })
})

describe('findPlace', () => {
  it('finds the first gap, else the bottom', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 9, y: 0, w: 3, h: 2 },
    ]
    expect(findPlace(items, { w: 3, h: 2 }, opts)).toEqual({ x: 6, y: 0 })
    expect(findPlace(items, { w: 4, h: 1 }, opts)).toEqual({ x: 0, y: 2 })
    expect(layoutHeight(items)).toBe(2)
  })
})

/** Items of the given widths side by side on the first row. */
const inRow = (widths: number[], h = 1) => {
  let x = 0
  return widths.map((w, i) => {
    const item = { id: 'abcdefghijkl'[i]!, x, y: 0, w, h }
    x += w
    return item
  })
}

describe('deriveLayout', () => {
  const wide = [
    { id: 'a', x: 0, y: 0, w: 6, h: 2 },
    { id: 'b', x: 6, y: 0, w: 6, h: 3 },
    { id: 'c', x: 0, y: 3, w: 4, h: 1 },
  ]

  it('scales to fewer columns', () => {
    expect(byId(deriveLayout(wide, 12, { columns: 6 }))).toEqual({
      a: [0, 0, 3, 2],
      b: [3, 0, 3, 3],
      c: [0, 2, 2, 1],
    })
  })

  it('wraps a row onto two lines to keep equally wide items equally wide', () => {
    const below = { id: 'z', x: 0, y: 2, w: 12, h: 1 }
    const out = deriveLayout([...inRow([3, 3, 3, 3], 2), below], 12, { columns: 6 })
    expect(byId(out)).toEqual({
      a: [0, 0, 3, 2],
      b: [3, 0, 3, 2],
      c: [0, 2, 3, 2],
      d: [3, 2, 3, 2],
      z: [0, 4, 6, 1],
    })
    noOverlap(out)
    // also without compacting: the row below moves down by the added line
    expect(
      byId(deriveLayout([...inRow([3, 3, 3, 3], 2), below], 12, { columns: 6, compact: false })).z,
    ).toEqual([0, 4, 6, 1])
    expect(byId(deriveLayout(inRow([4, 4, 4]), 12, { columns: 8 }))).toEqual({
      a: [0, 0, 4, 1],
      b: [4, 0, 4, 1],
      c: [0, 1, 4, 1],
    })
    expect(byId(deriveLayout(inRow([3, 3, 6]), 12, { columns: 6 }))).toEqual({
      a: [0, 0, 3, 1],
      b: [3, 0, 3, 1],
      c: [0, 1, 6, 1],
    })
  })

  it('packs a wrapped row without the gaps in it', () => {
    const gaps = [
      { id: 'a', x: 0, y: 0, w: 3, h: 1 },
      { id: 'b', x: 6, y: 0, w: 3, h: 1 },
      { id: 'c', x: 9, y: 0, w: 3, h: 1 },
    ]
    expect(byId(deriveLayout(gaps, 12, { columns: 6 }))).toEqual({
      a: [0, 0, 3, 1],
      b: [3, 0, 3, 1],
      c: [0, 1, 3, 1],
    })
  })

  it('rounds the widths of a wrapped row down when they would differ', () => {
    // 3.5 columns each on 7
    expect(byId(deriveLayout(inRow([3, 3, 3, 3]), 12, { columns: 7 }))).toEqual({
      a: [0, 0, 3, 1],
      b: [3, 0, 3, 1],
      c: [0, 1, 3, 1],
      d: [3, 1, 3, 1],
    })
    expect(byId(deriveLayout(inRow([4, 4, 4]), 12, { columns: 5 }))).toEqual({
      a: [0, 0, 2, 1],
      b: [2, 0, 2, 1],
      c: [0, 1, 2, 1],
    })
    expect(byId(deriveLayout(inRow([3, 3, 3, 3]), 12, { columns: 5 }))).toEqual({
      a: [0, 0, 2, 1],
      b: [2, 0, 2, 1],
      c: [0, 1, 2, 1],
      d: [2, 1, 2, 1],
    })
    expect(byId(deriveLayout(inRow([2, 2, 2, 2, 2, 2]), 12, { columns: 4 }))).toEqual({
      a: [0, 0, 1, 1],
      b: [1, 0, 1, 1],
      c: [2, 0, 1, 1],
      d: [0, 1, 1, 1],
      e: [1, 1, 1, 1],
      f: [2, 1, 1, 1],
    })
  })

  it('leaves columns empty instead of putting items one per line', () => {
    expect(byId(deriveLayout(inRow([6, 6]), 12, { columns: 5 }))).toEqual({
      a: [0, 0, 2, 1],
      b: [2, 0, 2, 1],
    })
    // the nearest width fits once the second item moves left
    const apart = [
      { id: 'a', x: 0, y: 0, w: 3, h: 1 },
      { id: 'b', x: 9, y: 0, w: 3, h: 1 },
    ]
    expect(byId(deriveLayout(apart, 12, { columns: 6 }))).toEqual({
      a: [0, 0, 2, 1],
      b: [4, 0, 2, 1],
    })
  })

  it('wraps onto more lines when items would get no column', () => {
    const out = deriveLayout(inRow(Array.from({ length: 12 }, () => 1)), 12, { columns: 5 })
    expect(out.map((item) => [item.x, item.y, item.w])).toEqual([
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 1],
      [3, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
      [2, 1, 1],
      [3, 1, 1],
      [0, 2, 1],
      [1, 2, 1],
      [2, 2, 1],
      [3, 2, 1],
    ])
  })

  it('leaves rows of unequal items side by side', () => {
    expect(byId(deriveLayout(inRow([5, 7]), 12, { columns: 6 }))).toEqual({
      a: [0, 0, 3, 1],
      b: [3, 0, 3, 1],
    })
  })

  it("doesn't wrap a row with a tall item or one that others reach into", () => {
    const tall = [
      { id: 'a', x: 0, y: 0, w: 3, h: 4 },
      { id: 'b', x: 3, y: 0, w: 3, h: 1 },
      { id: 'c', x: 6, y: 0, w: 3, h: 1 },
      { id: 'd', x: 9, y: 0, w: 3, h: 1 },
      { id: 'e', x: 3, y: 1, w: 9, h: 3 },
    ]
    const out = byId(deriveLayout(tall, 12, { columns: 6 }))
    expect(out).toEqual({
      a: [0, 0, 1, 4],
      b: [1, 0, 1, 1],
      c: [2, 0, 1, 1],
      d: [3, 0, 1, 1],
      e: [2, 1, 4, 3],
    })
    const side = [
      { id: 't', x: 0, y: 0, w: 6, h: 4 },
      { id: 'a', x: 6, y: 0, w: 3, h: 1 },
      { id: 'b', x: 9, y: 0, w: 3, h: 1 },
      { id: 'q', x: 6, y: 1, w: 6, h: 3 },
    ]
    expect(byId(deriveLayout(side, 12, { columns: 6 }))).toEqual({
      t: [0, 0, 3, 4],
      a: [3, 0, 1, 1],
      b: [4, 0, 1, 1],
      q: [3, 1, 3, 3],
    })
  })

  it('scales the size limits of wrapped items like their widths', () => {
    const limited = inRow([3, 3, 3, 3]).map((item) => ({ ...item, maxW: 3 }))
    const out = deriveLayout(limited, 12, { columns: 6 })
    expect(out.map((item) => [item.w, item.maxW])).toEqual([
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
    ])
  })

  it("doesn't wrap when the grid gets wider", () => {
    expect(byId(deriveLayout(inRow([1, 1, 1, 1]), 4, { columns: 6 }))).toEqual({
      a: [0, 0, 1, 1],
      b: [1, 0, 1, 1],
      c: [2, 0, 1, 1],
      d: [3, 0, 1, 1],
    })
  })

  it('stacks in reading order on one column', () => {
    expect(byId(deriveLayout(wide, 12, { columns: 1 }))).toEqual({
      a: [0, 0, 1, 2],
      b: [0, 2, 1, 3],
      c: [0, 5, 1, 1],
    })
  })
})
