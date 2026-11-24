import { markRaw } from 'vue'
import type { ChangeSet } from '../core/changes'
import type { CodeDiffHunk, CodeDiffOptions } from '../core/diff'
import type { CodeText } from '../core/text'
import type { CodeLanguage, CodeLineTokens } from './language'
import {
  decodeState,
  type FromWorker,
  languagesIn,
  type ToWorker,
  type WorkerSyntaxMode,
} from './worker-protocol'

let nextId = 1
let nextDiffId = 1

/** Lines sent to the worker in one message, so sending a long text never holds up the page long. */
const PIECE = 20_000

/** Default idle keep-alive for pooled workers (ms) so fast list scrolling reuses warm workers. */
const DEFAULT_IDLE_TIMEOUT = 10_000

export function defaultPoolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0
  if (!cores || !Number.isFinite(cores)) return 2
  if (cores <= 1) return 1
  return Math.min(4, Math.max(2, Math.floor(cores / 2)))
}

export interface SyntaxWorkerHandlers {
  states: (points: Array<[line: number, state: unknown]>) => void
  /** Flat per-line tokens returned in `tokens` mode (e.g. Shiki or non-serializable states). */
  tokens?: (from: number, lines: readonly CodeLineTokens[], frontier: number) => void
  /** The worker hasn't the language named `missing`, or can't highlight it (no `missing`). */
  unsupported: (missing?: string) => void
  /** The worker could not run (it failed to load, or threw). */
  failed: (error: unknown) => void
  /** Notifies a worker pool whether this client currently has an in-flight request. */
  onBusyChange?: (busy: boolean) => void
}

interface AskedRange {
  from: number
  until: number
  tokensFrom?: number
  tokensTo?: number
}

/**
 * The editor's side of a highlighting worker (`serveCodeHighlighting`).
 * The text goes over the first time syntax data is wanted, in pieces between
 * other work; every change follows it. Newer viewport requests preempt older
 * ones, and `cancel()` aborts pending work when scrolled out of view.
 */
export class SyntaxWorkerClient {
  private readonly id = nextId++
  /** Changes sent so far; the worker's answers name how many it had taken in. */
  private version = 0
  /** Monotonic request counter so newer viewport requests preempt stale ones. */
  private seq = 0
  private asking = false
  private paused = false
  private busy = false
  private lastAsked: AskedRange | null = null
  private closed = false
  /** Sending the text: messages wait until it is all there. */
  private sending = false
  private opened = false
  private queue: ToWorker[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly languages: Map<string, CodeLanguage>
  private readonly mode: WorkerSyntaxMode

  constructor(
    private readonly worker: Worker,
    private readonly language: CodeLanguage,
    /** The text as it is now. */
    private readonly text: () => CodeText,
    private readonly tabSize: number,
    private readonly handlers: SyntaxWorkerHandlers,
  ) {
    this.languages = languagesIn(language)
    this.mode = language.workerMode === 'tokens' ? 'tokens' : 'auto'
    worker.addEventListener('error', this.fail)
  }

  private setBusy(next: boolean) {
    if (this.busy === next) return
    this.busy = next
    this.handlers.onBusyChange?.(next)
  }

  private fail = (event: Event) => {
    if (this.closed) return
    this.dispose()
    this.handlers.failed((event as ErrorEvent).error ?? (event as ErrorEvent).message ?? event)
  }

  private post(message: ToWorker) {
    if (this.sending) {
      if (message.t === 'read') {
        // Only the latest viewport request matters while text chunks are still being streamed.
        this.queue = this.queue.filter((item) => item.t !== 'read')
      } else if (message.t === 'cancel') {
        this.queue = this.queue.filter((item) => item.t !== 'read')
      }
      this.queue.push(message)
      return
    }
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker takes no origin
    this.worker.postMessage(message)
  }

  private open() {
    this.opened = true
    this.worker.addEventListener('message', this.listen)
    const nested = [...this.languages.keys()].filter((name) => name !== this.language.name)
    this.post({
      t: 'open',
      id: this.id,
      language: this.language.name,
      nested,
      tabSize: this.tabSize,
      mode: this.mode,
    })
    this.sending = true
    const doc = this.text()
    let from = 1
    const next = () => {
      this.timer = null
      if (this.closed) return
      const to = Math.min(doc.lines, from + PIECE - 1)
      const done = to >= doc.lines
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker takes no origin
      this.worker.postMessage({ t: 'text', id: this.id, lines: doc.lineTexts(from, to), done })
      from = to + 1
      if (!done) {
        this.timer = setTimeout(next, 0)
        return
      }
      this.sending = false
      const queue = this.queue
      this.queue = []
      for (const message of queue) this.post(message)
    }
    next()
  }

  private listen = (event: MessageEvent) => {
    const message = event.data as FromWorker
    if (this.closed || !message || message.id !== this.id) return
    if (message.t === 'unsupported') {
      this.dispose()
      this.handlers.unsupported(message.missing)
      return
    }
    if (message.t !== 'states' && message.t !== 'tokens') return
    const isLatestSeq = message.seq === undefined || message.seq === this.seq
    if (isLatestSeq) {
      this.asking = false
      this.lastAsked = null
      this.setBusy(false)
    }
    // Changed since it was asked: what it read is for another text; asking again gets the new one.
    if (message.version !== this.version) return
    if (message.t === 'tokens') {
      if (!this.handlers.tokens) {
        this.dispose()
        this.handlers.unsupported()
        return
      }
      this.handlers.tokens(message.from, message.lines, message.frontier)
      return
    }
    const points: Array<[number, unknown]> = []
    for (const [line, state] of message.points) {
      const decoded = decodeState(state, (name) => this.languages.get(name))
      if (decoded === undefined) {
        this.dispose()
        this.handlers.unsupported()
        return
      }
      points.push([line, decoded])
    }
    this.handlers.states(points)
  }

  /** Passes on a change made to the text, once the worker has it. */
  change(changes: ChangeSet): void {
    if (this.closed || !this.opened || changes.empty) return
    this.version++
    this.lastAsked = null
    this.post({
      t: 'change',
      id: this.id,
      changes: changes.changes.map((change) => [change.from, change.to, change.insert]),
      length: changes.length,
    })
  }

  /**
   * Requests syntax data up to `until` (and flat tokens for 1-based inclusive
   * `[tokensFrom, tokensTo]` when in `tokens` mode). A new range preempts any
   * older in-flight request.
   */
  want(from: number, until: number, tokensFrom?: number, tokensTo?: number): void {
    if (this.closed) return
    if (
      this.asking &&
      this.lastAsked &&
      this.lastAsked.from === from &&
      this.lastAsked.until === until &&
      this.lastAsked.tokensFrom === tokensFrom &&
      this.lastAsked.tokensTo === tokensTo
    ) {
      return
    }
    if (!this.opened) this.open()
    this.paused = false
    this.asking = true
    this.lastAsked = { from, until, tokensFrom, tokensTo }
    this.setBusy(true)
    const seq = ++this.seq
    this.post({ t: 'read', id: this.id, from, until, tokensFrom, tokensTo, seq })
  }

  /** Cancels any pending highlighting task for this document (e.g. when scrolled out of view). */
  cancel(): void {
    if (this.closed) return
    if (!this.asking && !this.lastAsked && this.paused) return
    if (this.asking) this.seq++
    this.asking = false
    this.lastAsked = null
    this.paused = true
    this.setBusy(false)
    if (this.opened) this.post({ t: 'cancel', id: this.id })
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    this.asking = false
    this.lastAsked = null
    this.setBusy(false)
    if (this.timer) clearTimeout(this.timer)
    this.worker.removeEventListener('error', this.fail)
    if (!this.opened) return
    this.worker.removeEventListener('message', this.listen)
    this.sending = false
    this.queue = []
    this.post({ t: 'close', id: this.id })
  }
}

export interface WorkerDiffRequest {
  promise: Promise<CodeDiffHunk[]>
  cancel(): void
}

/** Runs `diffText` asynchronously inside a `serveCodeHighlighting` worker, with cancellation support. */
export function requestWorkerDiff(
  worker: Worker,
  original: string,
  modified: string,
  options?: CodeDiffOptions,
): WorkerDiffRequest {
  const id = nextDiffId++
  let settled = false
  let cleanup: (() => void) | null = null

  const promise = new Promise<CodeDiffHunk[]>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data as FromWorker
      if (!message || message.t !== 'diffResult' || message.id !== id) return
      settled = true
      cleanup?.()
      resolve(message.hunks)
    }
    const onError = (event: Event) => {
      if (settled) return
      settled = true
      cleanup?.()
      reject((event as ErrorEvent).error ?? (event as ErrorEvent).message ?? event)
    }
    cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    const msg: ToWorker = { t: 'diff', id, original, modified, options }
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker takes no origin
    worker.postMessage(msg)
  })

  return {
    promise,
    cancel() {
      if (settled) return
      settled = true
      cleanup?.()
      const msg: ToWorker = { t: 'cancelDiff', id }
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker takes no origin
      worker.postMessage(msg)
    },
  }
}

// ---------------------------------------------------------------- worker pool

export interface CodeWorkerPoolOptions {
  /**
   * Maximum number of workers spawned lazily on demand.
   * Defaults to `Math.min(4, Math.max(2, Math.floor((hardwareConcurrency || 4) / 2)))` (1 on single-core).
   */
  maxWorkers?: number
  /**
   * Milliseconds to keep an idle worker alive after its last user releases it,
   * avoiding repeated worker/WASM startup during fast list scrolling.
   * Defaults to `10_000`. Set to `0` to terminate immediately when idle.
   */
  idleTimeout?: number
}

/**
 * A lazily-spawned pool of highlighting workers shared across `DouCodeEditor`
 * and `DouCodeDiff` instances via the `worker` prop.
 */
export interface CodeWorkerPool {
  readonly kind: 'pool'
  /** Number of currently live worker instances in the pool. */
  readonly size: number
  /** Maximum number of workers the pool may spawn. */
  readonly maxWorkers: number
  /** Terminates all live workers and clears idle timers. */
  dispose(): void
}

/** Accepted values for the `worker` prop on `DouCodeEditor` and `DouCodeDiff`. */
export type CodeWorkerOption = boolean | (() => Worker) | CodeWorkerPool

export interface AcquiredWorker {
  worker: Worker
  release: () => void
  setBusy?: (busy: boolean) => void
}

interface WorkerSlot {
  worker: Worker
  users: number
  activeTasks: number
  idleTimer: ReturnType<typeof setTimeout> | null
  failed: boolean
  onError: () => void
}

class WorkerPoolImpl {
  readonly maxWorkers: number
  private readonly idleTimeout: number
  private slots: WorkerSlot[] = []
  private spawning: Promise<WorkerSlot>[] = []
  private generation = 0

  constructor(
    private readonly factory: () => Worker | Promise<Worker>,
    options: CodeWorkerPoolOptions = {},
  ) {
    this.maxWorkers = Math.max(1, Math.floor(options.maxWorkers ?? defaultPoolSize()))
    this.idleTimeout = Math.max(0, options.idleTimeout ?? DEFAULT_IDLE_TIMEOUT)
  }

  get size(): number {
    return this.slots.length
  }

  private evict(slot: WorkerSlot) {
    if (slot.idleTimer) {
      clearTimeout(slot.idleTimer)
      slot.idleTimer = null
    }
    slot.failed = true
    slot.worker.removeEventListener('error', slot.onError)
    const index = this.slots.indexOf(slot)
    if (index >= 0) this.slots.splice(index, 1)
    slot.worker.terminate()
  }

  private lease(slot: WorkerSlot): AcquiredWorker {
    if (slot.idleTimer) {
      clearTimeout(slot.idleTimer)
      slot.idleTimer = null
    }
    slot.users++
    let released = false
    let busy = false
    const setBusy = (next: boolean) => {
      if (released || busy === next) return
      busy = next
      slot.activeTasks = Math.max(0, slot.activeTasks + (next ? 1 : -1))
    }
    return {
      worker: slot.worker,
      setBusy,
      release: () => {
        if (released) return
        setBusy(false)
        released = true
        slot.users = Math.max(0, slot.users - 1)
        if (slot.users > 0 || slot.failed) return
        if (this.idleTimeout <= 0) {
          this.evict(slot)
          return
        }
        slot.idleTimer = setTimeout(() => {
          slot.idleTimer = null
          if (slot.users === 0 && !slot.failed) this.evict(slot)
        }, this.idleTimeout)
      },
    }
  }

  private pickBest(): WorkerSlot | null {
    let best: WorkerSlot | null = null
    for (const slot of this.slots) {
      if (slot.failed) continue
      if (
        !best ||
        slot.activeTasks < best.activeTasks ||
        (slot.activeTasks === best.activeTasks && slot.users < best.users)
      ) {
        best = slot
      }
    }
    return best
  }

  async acquire(): Promise<AcquiredWorker> {
    // 1. Reuse a completely idle warm worker if one is available.
    const idle = this.slots.find(
      (slot) => !slot.failed && slot.users === 0 && slot.activeTasks === 0,
    )
    if (idle) return this.lease(idle)

    // 2. Otherwise lazily spawn a new worker if under the pool limit.
    if (this.slots.length + this.spawning.length < this.maxWorkers) {
      const gen = this.generation
      const creating = Promise.resolve()
        .then(() => this.factory())
        .then((worker) => {
          if (gen !== this.generation) {
            worker.terminate()
            throw new Error('[@dou-ui/code] worker pool disposed')
          }
          const slot: WorkerSlot = {
            worker,
            users: 0,
            activeTasks: 0,
            idleTimer: null,
            failed: false,
            onError: () => this.evict(slot),
          }
          worker.addEventListener('error', slot.onError)
          this.slots.push(slot)
          return slot
        })
      this.spawning.push(creating)
      try {
        const slot = await creating
        return this.lease(slot)
      } finally {
        const idx = this.spawning.indexOf(creating)
        if (idx >= 0) this.spawning.splice(idx, 1)
      }
    }

    // 3. At capacity: reuse the least-loaded live worker, or wait for an in-flight spawn.
    const best = this.pickBest()
    if (best) return this.lease(best)
    const first = this.spawning[0]
    if (first) {
      const slot = await first
      if (!slot.failed) return this.lease(slot)
    }
    return this.acquire()
  }

  dispose(): void {
    this.generation++
    const current = this.slots.slice()
    this.slots = []
    for (const slot of current) {
      if (slot.idleTimer) {
        clearTimeout(slot.idleTimer)
        slot.idleTimer = null
      }
      slot.failed = true
      slot.worker.removeEventListener('error', slot.onError)
      slot.worker.terminate()
    }
  }
}

const pools = new WeakMap<CodeWorkerPool, WorkerPoolImpl>()

/**
 * Creates a lazily-spawned worker pool that can be passed to the `worker` prop
 * of multiple `DouCodeEditor` and `DouCodeDiff` instances.
 *
 * Workers are created only when concurrent tasks need them (up to `maxWorkers`)
 * and kept warm briefly when idle so scrolling through a multi-file list avoids
 * re-initializing workers or Shiki WASM grammars.
 */
export function createCodeWorkerPool(
  factory: () => Worker,
  options?: CodeWorkerPoolOptions,
): CodeWorkerPool {
  const impl = new WorkerPoolImpl(factory, options)
  const handle: CodeWorkerPool = markRaw({
    kind: 'pool',
    get size() {
      return impl.size
    },
    get maxWorkers() {
      return impl.maxWorkers
    },
    dispose() {
      impl.dispose()
    },
  })
  pools.set(handle, impl)
  return handle
}

export function isCodeWorkerPool(value: unknown): value is CodeWorkerPool {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as CodeWorkerPool).kind === 'pool' &&
    pools.has(value as CodeWorkerPool)
  )
}

export function acquirePoolWorker(pool: CodeWorkerPool): Promise<AcquiredWorker> {
  const impl = pools.get(pool)
  if (!impl) return Promise.reject(new Error('[@dou-ui/code] invalid code worker pool'))
  return impl.acquire()
}

/** Built-in lazy worker pool for `worker: true` (built-in languages + async diff). */
let ownPool: WorkerPoolImpl | null = null

function getOwnPool(): WorkerPoolImpl {
  if (!ownPool) {
    ownPool = new WorkerPoolImpl(async () => {
      const { default: CodeWorker } = await import('../worker/default?worker&inline')
      return new CodeWorker()
    })
  }
  return ownPool
}

/** Acquires a worker from the built-in lazily-spawned worker pool (`worker: true`). */
export function ownWorker(): Promise<AcquiredWorker> {
  return getOwnPool().acquire()
}

/** Disposes the built-in worker pool (useful in tests or teardown). */
export function disposeOwnWorkerPool(): void {
  ownPool?.dispose()
  ownPool = null
}

/** Editors using each worker made by a `worker` function: one handed to several ends with the last. */
const holders = new Map<Worker, number>()

/** Counts an editor using `worker`; the returned function lets go, ending the worker after the last. */
export function holdWorker(worker: Worker): () => void {
  holders.set(worker, (holders.get(worker) ?? 0) + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    const left = holders.get(worker)! - 1
    if (left > 0) {
      holders.set(worker, left)
      return
    }
    holders.delete(worker)
    worker.terminate()
  }
}
