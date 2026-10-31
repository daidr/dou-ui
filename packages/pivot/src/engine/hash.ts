/**
 * A table from whole numbers (0 to 2^53) to the order they were first seen
 * in: open addressing over typed arrays, so millions of lookups allocate
 * nothing and never touch a `Map`.
 */
export class IntIndex {
  /** The keys by slot; `-1` marks a free slot. */
  private table: Float64Array
  /** What each slot's key maps to. */
  private ids: Int32Array
  private mask: number
  /** The keys in the order they were added. */
  keys: Float64Array
  size = 0

  constructor(expected = 16) {
    let capacity = 16
    while (capacity < expected * 2) capacity *= 2
    this.table = new Float64Array(capacity).fill(-1)
    this.ids = new Int32Array(capacity)
    this.mask = capacity - 1
    this.keys = new Float64Array(Math.max(8, expected))
  }

  /** The id of `key`, or -1. */
  get(key: number) {
    const { table, mask } = this
    let slot = hash(key) & mask
    for (;;) {
      const at = table[slot]!
      if (at === key) return this.ids[slot]!
      if (at === -1) return -1
      slot = (slot + 1) & mask
    }
  }

  /** The id of `key`, adding it with the next id when it is new. */
  add(key: number) {
    const { table, mask } = this
    let slot = hash(key) & mask
    for (;;) {
      const at = table[slot]!
      if (at === key) return this.ids[slot]!
      if (at === -1) break
      slot = (slot + 1) & mask
    }
    const id = this.size++
    table[slot] = key
    this.ids[slot] = id
    if (id >= this.keys.length) {
      const keys = new Float64Array(this.keys.length * 2 || 8)
      keys.set(this.keys)
      this.keys = keys
    }
    this.keys[id] = key
    if (this.size * 2 > table.length) this.grow()
    return id
  }

  /** Its arrays, to send to another thread (moved, not copied) or save. */
  pack(): PivotIndexPacket {
    return { table: this.table, ids: this.ids, keys: this.keys, size: this.size }
  }

  /** An index made from `pack()`'s output; plain arrays (from JSON) work too. */
  static unpack(packet: PivotIndexPacket): IntIndex {
    const index = new IntIndex(0)
    index.table = typed(Float64Array, packet.table)
    index.ids = typed(Int32Array, packet.ids)
    index.keys = typed(Float64Array, packet.keys)
    index.mask = index.table.length - 1
    index.size = packet.size
    return index
  }

  private grow() {
    const capacity = this.table.length * 2
    const table = new Float64Array(capacity).fill(-1)
    const ids = new Int32Array(capacity)
    const mask = capacity - 1
    const { keys, size } = this
    for (let id = 0; id < size; id++) {
      const key = keys[id]!
      let slot = hash(key) & mask
      while (table[slot] !== -1) slot = (slot + 1) & mask
      table[slot] = key
      ids[slot] = id
    }
    this.table = table
    this.ids = ids
    this.mask = mask
  }
}

type TypedArrayOf =
  Float64ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Uint8ArrayConstructor

/** The array as it is when it is already of that type (moved from a worker), else a typed copy (from JSON). */
export function typed<T extends TypedArrayOf>(Type: T, array: ArrayLike<number>): InstanceType<T> {
  return (array instanceof Type ? array : Type.from(array)) as InstanceType<T>
}

/** An `IntIndex` as data. */
export interface PivotIndexPacket {
  table: ArrayLike<number>
  ids: ArrayLike<number>
  keys: ArrayLike<number>
  size: number
}

const HIGH = 4294967296

/** Mixes both halves of a key up to 2^53 into 32 bits. */
function hash(key: number) {
  let h = Math.imul((key >>> 0) ^ Math.imul((key / HIGH) | 0, 0x9e3779b1), 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  return h ^ (h >>> 16)
}
