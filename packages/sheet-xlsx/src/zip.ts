/*
 * A small zip writer and reader, enough for the parts of an .xlsx file.
 * Compression uses the platform's `CompressionStream`, which browsers,
 * Bun and Node all have.
 */

const encoder = new TextEncoder()

/** Lets the page handle what is waiting, such as input, before going on. */
export const pause = () => new Promise<void>((resolve) => setTimeout(resolve))

/** How long work goes on before letting the page go on, in ms. */
export const SLICE = 50

/** What `zip` and `unzip` need of the platform, checked so the error says so. */
function streams() {
  if (typeof CompressionStream !== 'function' || typeof DecompressionStream !== 'function')
    throw new Error(
      '[@dou-ui/sheet-xlsx] needs CompressionStream (browsers since 2023, Node 18, Bun, Deno) to write and read .xlsx files',
    )
}

/** The bytes the stream's other end gives. */
async function collect(readable: ReadableStream<Uint8Array>) {
  const pieces: Uint8Array[] = []
  let size = 0
  const reader = readable.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    pieces.push(value)
    size += value.length
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const piece of pieces) {
    out.set(piece, at)
    at += piece.length
  }
  return out
}

/** How `zip` goes on with a big file: when to let the page go on, and when to stop. */
export interface ZipPacing {
  signal?: AbortSignal
  /** When work last let the page go on, from `performance.now()`; kept up to date. */
  lastPause: { at: number }
}

// a file goes through the compressor this much at a time, so the page can go on in between
const PIECE = 1 << 18

/** Bytes through a compressor or decompressor, a piece at a time, letting the page go on between pieces. */
async function through(
  bytes: Uint8Array[],
  stream: CompressionStream | DecompressionStream,
  pacing?: ZipPacing,
) {
  const result = collect(stream.readable)
  const writer = stream.writable.getWriter()
  try {
    for (const bytesPiece of bytes)
      for (let at = 0; at < bytesPiece.length; at += PIECE) {
        await writer.write(bytesPiece.subarray(at, at + PIECE) as Uint8Array<ArrayBuffer>)
        if (pacing && performance.now() - pacing.lastPause.at > SLICE) {
          await pause()
          pacing.signal?.throwIfAborted()
          pacing.lastPause.at = performance.now()
        }
      }
    await writer.close()
  } catch (error) {
    await writer.abort(error).catch(() => {})
    throw error
  }
  return result
}

/** The deflated bytes of a gzip stream, with the CRC-32 and size of what went in. */
function fromGzip(gz: Uint8Array) {
  if (gz[0] !== 0x1f || gz[1] !== 0x8b) throw new Error('[@dou-ui/sheet-xlsx] not a gzip stream')
  const flags = gz[3]!
  let at = 10
  if (flags & 4) at += 2 + (gz[at]! | (gz[at + 1]! << 8))
  if (flags & 8) while (gz[at++] !== 0);
  if (flags & 16) while (gz[at++] !== 0);
  if (flags & 2) at += 2
  const view = new DataView(gz.buffer, gz.byteOffset, gz.byteLength)
  return {
    packed: gz.subarray(at, gz.length - 8),
    crc: view.getUint32(gz.length - 8, true),
    length: view.getUint32(gz.length - 4, true),
  }
}

/** A file to put in a zip: its path, and its text or bytes, whole or in pieces. */
export interface ZipEntry {
  path: string
  data: string | Uint8Array | Uint8Array[]
}

/**
 * Packs files into a zip, compressed. The files' times are left at the
 * zip format's first day, so the same files give the same bytes.
 */
export async function zip(entries: readonly ZipEntry[], pacing?: ZipPacing): Promise<Uint8Array> {
  streams()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const raw =
      typeof entry.data === 'string'
        ? [encoder.encode(entry.data)]
        : Array.isArray(entry.data)
          ? entry.data
          : [entry.data]
    // gzip is deflate with the CRC-32 and size after it, worked out by the platform
    const { packed, crc, length } = fromGzip(
      await through(raw, new CompressionStream('gzip'), pacing),
    )
    // DOS date 1980-01-01, time 00:00
    const time = 0
    const date = (0 << 9) | (1 << 5) | 1
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // names in UTF-8
    local.setUint16(8, 8, true) // deflate
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, packed.length, true)
    local.setUint32(22, length, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)
    parts.push(new Uint8Array(local.buffer), name, packed)

    const head = new DataView(new ArrayBuffer(46))
    head.setUint32(0, 0x02014b50, true)
    head.setUint16(4, 20, true)
    head.setUint16(6, 20, true)
    head.setUint16(8, 0x0800, true)
    head.setUint16(10, 8, true)
    head.setUint16(12, time, true)
    head.setUint16(14, date, true)
    head.setUint32(16, crc, true)
    head.setUint32(20, packed.length, true)
    head.setUint32(24, length, true)
    head.setUint16(28, name.length, true)
    head.setUint32(42, offset, true)
    central.push(new Uint8Array(head.buffer), name)
    offset += 30 + name.length + packed.length
  }
  const size = central.reduce((total, part) => total + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, size, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((total, part) => total + part.length, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** Reads the files of a zip, by path. Only stored and deflated files, as .xlsx files have. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  streams()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  if (end === -1)
    throw new Error("[@dou-ui/sheet-xlsx] the file isn't a zip, so it isn't an .xlsx file")
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files = new Map<string, Uint8Array>()
  const decoder = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50)
      throw new Error('[@dou-ui/sheet-xlsx] the zip is damaged')
    const method = view.getUint16(at + 10, true)
    const packedSize = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const local = view.getUint32(at + 42, true)
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const packed = bytes.subarray(start, start + packedSize)
    if (method === 0) files.set(name, packed.slice())
    else if (method === 8)
      files.set(name, await through([packed], new DecompressionStream('deflate-raw')))
    else throw new Error(`[@dou-ui/sheet-xlsx] "${name}" is packed in a way that can't be read`)
    at += 46 + nameLength + extraLength + commentLength
  }
  return files
}
