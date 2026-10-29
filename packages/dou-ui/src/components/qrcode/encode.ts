/**
 * A QR code encoder (ISO/IEC 18004): numeric, alphanumeric and byte
 * (UTF-8) segments, versions 1–40, all four error correction levels and
 * automatic mask choice. Returns the modules as rows of booleans.
 */

export type QrLevel = 'L' | 'M' | 'Q' | 'H'

/** Bits of the format information for each level. */
const LEVEL_BITS: Record<QrLevel, number> = { L: 1, M: 0, Q: 3, H: 2 }
const LEVEL_INDEX: Record<QrLevel, number> = { L: 0, M: 1, Q: 2, H: 3 }

// Per version (index 0 unused) and level: EC codewords per block, and number of blocks.
const EC_PER_BLOCK = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30,
    30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30,
    30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
]
const BLOCKS = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14,
    15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23,
    25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34,
    34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35,
    37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
]

/** Modules that carry data (data + EC) in a version, after the function patterns. */
function rawModules(version: number) {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

function dataCodewords(version: number, level: QrLevel) {
  const l = LEVEL_INDEX[level]
  return Math.floor(rawModules(version) / 8) - EC_PER_BLOCK[l]![version]! * BLOCKS[l]![version]!
}

/* segments */

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'

type Mode = 'numeric' | 'alphanumeric' | 'byte'
const MODE_BITS: Record<Mode, number> = { numeric: 1, alphanumeric: 2, byte: 4 }

function countBits(mode: Mode, version: number) {
  const tier = version <= 9 ? 0 : version <= 26 ? 1 : 2
  if (mode === 'numeric') return [10, 12, 14][tier]!
  if (mode === 'alphanumeric') return [9, 11, 13][tier]!
  return [8, 16, 16][tier]!
}

interface Segment {
  mode: Mode
  /** Characters for numeric and alphanumeric, bytes for byte mode. */
  count: number
  bits: number[]
}

function pushBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
}

/** One segment in the most compact mode that holds the whole text. */
function makeSegment(text: string): Segment {
  const bits: number[] = []
  if (/^\d*$/.test(text)) {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3)
      pushBits(bits, Number(chunk), chunk.length * 3 + 1)
    }
    return { mode: 'numeric', count: text.length, bits }
  }
  if ([...text].every((char) => ALPHANUMERIC.includes(char))) {
    for (let i = 0; i < text.length; i += 2) {
      const a = ALPHANUMERIC.indexOf(text[i]!)
      if (i + 1 < text.length) pushBits(bits, a * 45 + ALPHANUMERIC.indexOf(text[i + 1]!), 11)
      else pushBits(bits, a, 6)
    }
    return { mode: 'alphanumeric', count: text.length, bits }
  }
  const bytes = new TextEncoder().encode(text)
  for (const byte of bytes) pushBits(bits, byte, 8)
  return { mode: 'byte', count: bytes.length, bits }
}

/* Reed–Solomon over GF(256) with the polynomial 0x11D */

function multiply(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function divisor(degree: number) {
  const result = Array.from({ length: degree }, () => 0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = multiply(result[j]!, root)
      if (j + 1 < result.length) result[j] = result[j]! ^ result[j + 1]!
    }
    root = multiply(root, 0x02)
  }
  return result
}

function remainder(data: number[], div: number[]) {
  const result = div.map(() => 0)
  for (const byte of data) {
    const factor = byte ^ result.shift()!
    result.push(0)
    div.forEach((coefficient, i) => (result[i] = result[i]! ^ multiply(coefficient, factor)))
  }
  return result
}

/** Split into blocks, add EC to each, and interleave. */
function addErrorCorrection(data: number[], version: number, level: QrLevel) {
  const l = LEVEL_INDEX[level]
  const blockCount = BLOCKS[l]![version]!
  const ecLength = EC_PER_BLOCK[l]![version]!
  const raw = Math.floor(rawModules(version) / 8)
  const shortCount = blockCount - (raw % blockCount)
  const shortLength = Math.floor(raw / blockCount)
  const div = divisor(ecLength)

  const blocks: number[][] = []
  for (let i = 0, k = 0; i < blockCount; i++) {
    const length = shortLength - ecLength + (i < shortCount ? 0 : 1)
    const block = data.slice(k, k + length)
    k += length
    const ec = remainder(block, div)
    // Short blocks get a placeholder so every block has the same length.
    if (i < shortCount) block.push(0)
    blocks.push([...block, ...ec])
  }

  const result: number[] = []
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - ecLength || j >= shortCount) result.push(block[i]!)
    })
  }
  return result
}

/** Penalties for long runs of one color and finder-like patterns in a line. */
function linePenalty(line: boolean[]) {
  let score = 0
  let run = 1
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) run++
    else {
      if (run >= 5) score += run - 2
      run = 1
    }
  }
  // Finder-like 1:1:3:1:1 runs with four light modules on one side.
  const text = line.map((dark) => (dark ? '1' : '0')).join('')
  const pattern = /(?=(10111010000|00001011101))/g
  score += [...text.matchAll(pattern)].length * 40
  return score
}

/* the symbol */

class Symbol_ {
  readonly size: number
  readonly modules: boolean[][]
  private readonly reserved: boolean[][]

  constructor(
    readonly version: number,
    readonly level: QrLevel,
  ) {
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => Array<boolean>(this.size).fill(false))
    this.reserved = Array.from({ length: this.size }, () => Array<boolean>(this.size).fill(false))
  }

  private set(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark
    this.reserved[y]![x] = true
  }

  drawFunctionPatterns() {
    const { size } = this
    for (let i = 0; i < size; i++) {
      this.set(6, i, i % 2 === 0)
      this.set(i, 6, i % 2 === 0)
    }
    this.finder(3, 3)
    this.finder(size - 4, 3)
    this.finder(3, size - 4)
    const positions = this.alignmentPositions()
    const n = positions.length
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const corner = (i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)
        if (!corner) this.alignment(positions[i]!, positions[j]!)
      }
    }
    this.drawFormat(0)
    this.drawVersion()
  }

  private finder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.set(xx, yy, distance !== 2 && distance !== 4)
        }
      }
    }
  }

  private alignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    }
  }

  private alignmentPositions() {
    const { version, size } = this
    if (version === 1) return []
    const count = Math.floor(version / 7) + 2
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2
    const result = [6]
    for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos)
    return result
  }

  drawFormat(mask: number) {
    const data = (LEVEL_BITS[this.level] << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((bits >>> i) & 1) !== 0
    const { size } = this
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i))
    this.set(8, 7, bit(6))
    this.set(8, 8, bit(7))
    this.set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) this.set(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) this.set(8, size - 15 + i, bit(i))
    this.set(8, size - 8, true)
  }

  private drawVersion() {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.set(a, b, dark)
      this.set(b, a, dark)
    }
  }

  drawCodewords(codewords: number[]) {
    const { size } = this
    let i = 0
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? size - 1 - vert : vert
          if (!this.reserved[y]![x] && i < codewords.length * 8) {
            this.modules[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0
            i++
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    const { size } = this
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (this.reserved[y]![x]) continue
        let invert: boolean
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0
            break
          case 1:
            invert = y % 2 === 0
            break
          case 2:
            invert = x % 3 === 0
            break
          case 3:
            invert = (x + y) % 3 === 0
            break
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
            break
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0
            break
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
            break
          default:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
        }
        if (invert) this.modules[y]![x] = !this.modules[y]![x]
      }
    }
  }

  /** The penalty score of the current modules; the mask with the lowest wins. */
  penalty() {
    const { size, modules } = this
    let result = 0
    for (let y = 0; y < size; y++) result += linePenalty(modules[y]!)
    for (let x = 0; x < size; x++) result += linePenalty(modules.map((row) => row[x]!))
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y]![x]
        if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) {
          result += 3
        }
      }
    }
    const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
    const total = size * size
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
    return result
  }
}

export interface QrCode {
  version: number
  level: QrLevel
  size: number
  /** `modules[y][x]` is `true` for a dark module. */
  modules: boolean[][]
}

/**
 * Encode `text` in the smallest version that fits at `level`, raising the
 * level while the version stays the same. Throws when the text is too long.
 */
export function encodeQr(text: string, level: QrLevel = 'M'): QrCode {
  const segment = makeSegment(text)
  let version = 1
  let used = 0
  for (; ; version++) {
    if (version > 40) throw new RangeError('[dou-ui] QRCode: the text is too long')
    used = 4 + countBits(segment.mode, version) + segment.bits.length
    if (
      segment.count < 2 ** countBits(segment.mode, version) &&
      used <= dataCodewords(version, level) * 8
    ) {
      break
    }
  }
  for (const better of ['M', 'Q', 'H'] as const) {
    if (LEVEL_INDEX[better] > LEVEL_INDEX[level] && used <= dataCodewords(version, better) * 8) {
      level = better
    }
  }

  const bits: number[] = []
  pushBits(bits, MODE_BITS[segment.mode], 4)
  pushBits(bits, segment.count, countBits(segment.mode, version))
  bits.push(...segment.bits)
  const capacity = dataCodewords(version, level) * 8
  pushBits(bits, 0, Math.min(4, capacity - bits.length))
  pushBits(bits, 0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) pushBits(bits, pad, 8)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0))
  }

  const symbol = new Symbol_(version, level)
  symbol.drawFunctionPatterns()
  symbol.drawCodewords(addErrorCorrection(data, version, level))

  let best = 0
  let lowest = Infinity
  for (let mask = 0; mask < 8; mask++) {
    symbol.applyMask(mask)
    symbol.drawFormat(mask)
    const score = symbol.penalty()
    if (score < lowest) {
      best = mask
      lowest = score
    }
    symbol.applyMask(mask)
  }
  symbol.applyMask(best)
  symbol.drawFormat(best)

  return { version, level, size: symbol.size, modules: symbol.modules }
}
