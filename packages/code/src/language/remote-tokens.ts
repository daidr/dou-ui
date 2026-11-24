import type { ChangeSet } from '../core/changes'
import type { CodeText } from '../core/text'
import type { CodeLineTokens } from './language'

/** Maximum number of line token arrays cached on the page in remote-token mode. */
const CACHE = 4000

/** Compresses sorted 1-based line numbers into contiguous inclusive `[from, to]` intervals. */
export function compressLineRanges(numbers: readonly number[]): Array<[from: number, to: number]> {
  const ranges: Array<[number, number]> = []
  for (let i = 0; i < numbers.length; i++) {
    const n = numbers[i]!
    const prev = ranges[ranges.length - 1]
    if (prev && n <= prev[1] + 1) {
      if (n > prev[1]) prev[1] = n
    } else {
      ranges.push([n, n])
    }
  }
  return ranges
}

/**
 * Caches flat per-line tokens returned by a highlighting worker in `tokens`
 * mode (e.g. Shiki grammars whose state lives only inside the worker).
 *
 * Lines before an edit stay fresh across document versions; lines after an edit
 * shift by the line delta so the viewport keeps its colors without flickering
 * while the worker recomputes the new version.
 */
export class RemoteTokenStore {
  private readonly maxSize: number
  /** 1-based line number → flat tokens, oldest first for LRU eviction. */
  private tokens = new Map<number, CodeLineTokens>()
  /** 1-based line number → version at which the cached tokens were produced. */
  private versions = new Map<number, number>()
  private currentVersion = 0
  private workerFrontier = 0

  constructor(maxSize = CACHE) {
    this.maxSize = Math.max(1, maxSize)
  }

  get version(): number {
    return this.currentVersion
  }

  get frontier(): number {
    return this.workerFrontier
  }

  /** Cached tokens for 1-based line `n`, or `null` if never received yet. */
  line(n: number): CodeLineTokens | null {
    return this.tokens.get(n) ?? null
  }

  /** Whether every line in 1-based inclusive `[from, to]` has tokens for the current version. */
  readyRange(from: number, to: number): boolean {
    for (let n = from; n <= to; n++) {
      if (this.versions.get(n) !== this.currentVersion) return false
    }
    return true
  }

  /** Whether every 1-based line number in `numbers` has tokens for the current version. */
  readyNumbers(numbers: readonly number[]): boolean {
    for (let i = 0; i < numbers.length; i++) {
      if (this.versions.get(numbers[i]!) !== this.currentVersion) return false
    }
    return true
  }

  /** Stores flat line tokens starting at 1-based line `from` from the worker. */
  adopt(from: number, lines: readonly CodeLineTokens[], frontier: number): void {
    this.workerFrontier = Math.max(this.workerFrontier, frontier)
    const cap = Math.max(this.maxSize, lines.length)
    for (let i = 0; i < lines.length; i++) {
      const n = from + i
      this.tokens.delete(n)
      this.tokens.set(n, lines[i]!)
      this.versions.set(n, this.currentVersion)
      if (this.tokens.size > cap) {
        const oldest = this.tokens.keys().next().value!
        this.tokens.delete(oldest)
        this.versions.delete(oldest)
      }
    }
  }

  /** Stores flat line tokens for multiple disjoint visible ranges returned by the worker. */
  adoptRanges(
    ranges: ReadonlyArray<readonly [from: number, lines: readonly CodeLineTokens[]]>,
    frontier: number,
  ): void {
    this.workerFrontier = Math.max(this.workerFrontier, frontier)
    let batchSize = 0
    for (const [, lines] of ranges) batchSize += lines.length
    const cap = Math.max(this.maxSize, batchSize)
    for (const [from, lines] of ranges) {
      for (let i = 0; i < lines.length; i++) {
        const n = from + i
        this.tokens.delete(n)
        this.tokens.set(n, lines[i]!)
        this.versions.set(n, this.currentVersion)
        if (this.tokens.size > cap) {
          const oldest = this.tokens.keys().next().value!
          this.tokens.delete(oldest)
          this.versions.delete(oldest)
        }
      }
    }
  }

  /** Shifts cached lines across an edit so unchanged regions avoid flicker while stale lines re-fetch. */
  update(oldDoc: CodeText, nextDoc: CodeText, changes?: ChangeSet): void {
    if (!changes) {
      this.clear()
      return
    }
    if (changes.empty) return
    this.currentVersion++
    const list = changes.changes
    const first = list[0]!
    const last = list[list.length - 1]!
    // 1-based inclusive line numbers touched in `oldDoc`.
    const a = oldDoc.lineAt(first.from).number
    const b = oldDoc.lineAt(last.to).number
    const end = nextDoc.lineAt(changes.mapPos(last.to, 1)).number
    const delta = end - b

    const nextTokens = new Map<number, CodeLineTokens>()
    const nextVersions = new Map<number, number>()
    for (const [line, value] of this.tokens) {
      const ver = this.versions.get(line) ?? -1
      if (line < a) {
        // Lines above the edit cannot change syntax state: keep them fresh.
        nextTokens.set(line, value)
        nextVersions.set(line, ver === this.currentVersion - 1 ? this.currentVersion : ver)
      } else if (line > b) {
        const shifted = line + delta
        if (shifted >= 1 && shifted <= nextDoc.lines) {
          nextTokens.set(shifted, value)
          // Keep previous version so `readyRange` requests updated tokens from the worker,
          // while rendering keeps temporary colors without flashing plain text.
          nextVersions.set(shifted, ver)
        }
      }
    }
    this.tokens = nextTokens
    this.versions = nextVersions
    this.workerFrontier = Math.min(this.workerFrontier, a - 1)
  }

  clear(): void {
    this.currentVersion++
    this.workerFrontier = 0
    this.tokens.clear()
    this.versions.clear()
  }
}
