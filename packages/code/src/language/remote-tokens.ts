import type { ChangeSet } from '../core/changes'
import type { CodeText } from '../core/text'
import type { CodeLineTokens } from './language'

/** Maximum number of line token arrays cached on the page in remote-token mode. */
const CACHE = 4000

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

  /** Stores flat line tokens starting at 1-based line `from` from the worker. */
  adopt(from: number, lines: readonly CodeLineTokens[], frontier: number): void {
    this.workerFrontier = Math.max(this.workerFrontier, frontier)
    for (let i = 0; i < lines.length; i++) {
      const n = from + i
      this.tokens.delete(n)
      this.tokens.set(n, lines[i]!)
      this.versions.set(n, this.currentVersion)
      if (this.tokens.size > this.maxSize) {
        const oldest = this.tokens.keys().next().value!
        this.tokens.delete(oldest)
        this.versions.delete(oldest)
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
