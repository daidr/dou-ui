import { ChangeSet } from '../core/changes'
import { type CodeDiffOptions, diffText } from '../core/diff'
import { CodeText } from '../core/text'
import { CodeHighlighter } from '../language/highlighter'
import type { CodeLanguage, CodeLineTokens } from '../language/language'
import {
  encodeState,
  type FromWorker,
  languagesIn,
  type ToWorker,
  type WorkerSyntaxMode,
} from '../language/worker-protocol'

export type { CodeLanguage }
// The languages and how to make one, so a worker needn't load the editor itself.
export { defineCodeLanguage, remoteCodeLanguage, copyPlain, samePlain } from '../language/language'
export type {
  CodeLanguageSpec,
  CodeLineTokens,
  CodeTokenType,
  RemoteCodeLanguageOptions,
} from '../language/language'
export type { CodeStream } from '../language/stream'
export { diffText } from '../core/diff'
export type { CodeDiffHunk, CodeDiffOptions, CodeDiffPart } from '../core/diff'
export { createJavaScript, javascript, jsx, tsx, typescript } from '../languages/javascript'
export { createCss, css, scss } from '../languages/css'
export { json } from '../languages/json'
export { createHtml, html, vue } from '../languages/html'
export { createMarkdown, markdown } from '../languages/markdown'
export { python } from '../languages/python'
export { shell } from '../languages/shell'
export { sql } from '../languages/sql'
export { yaml } from '../languages/yaml'

export interface WorkerMessageScope {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

export interface ServeCodeHighlightingOptions {
  /** Languages registered up front. */
  languages?: readonly CodeLanguage[]
  /**
   * Resolves a language by name on demand (for example lazy-loading a Shiki
   * grammar inside the worker). Concurrent requests for the same name share
   * one resolution; returning `null` or `undefined` marks it unsupported.
   */
  resolve?: (
    name: string,
  ) => CodeLanguage | null | undefined | Promise<CodeLanguage | null | undefined>
}

interface Asked {
  from: number
  until: number
  tokensFrom?: number
  tokensTo?: number
  seq?: number
}

interface Open {
  highlighter: CodeHighlighter
  version: number
  /** Whether this document returns flat per-line token arrays instead of state checkpoints. */
  tokenMode: boolean
  /** Paused by a `cancel` message until a newer `read` arrives. */
  paused: boolean
  /** Active viewport request. */
  asked: Asked | null
}

interface PendingOpen {
  nested: string[]
  tabSize: number
  mode: WorkerSyntaxMode
  messages: ToWorker[]
  closed: boolean
}

interface DiffTask {
  id: number
  original: string
  modified: string
  options?: CodeDiffOptions
}

/** How long each piece of work runs before yielding to handle cancel/preempt messages (ms). */
const SLICE = 16

/**
 * Reads code and computes diffs in a worker for `DouCodeEditor` and
 * `DouCodeDiff`'s `worker`, so syntax highlighting and large diffs stay off
 * the main thread. Call it in the worker's own module with the languages the
 * editors use, or with a `resolve` callback to lazy-load grammars (such as
 * Shiki) on demand:
 *
 * ```ts
 * // code-worker.ts
 * import { css, serveCodeHighlighting, typescript } from '@dou-ui/code/worker'
 *
 * serveCodeHighlighting([typescript, css])
 * ```
 *
 * Languages with plain-data states send state checkpoints; languages with
 * non-serializable states (such as Shiki's `StateStack`) automatically keep
 * their state in the worker and return flat per-line token arrays.
 */
export function serveCodeHighlighting(
  languagesOrOptions: readonly CodeLanguage[] | ServeCodeHighlightingOptions,
  scope: WorkerMessageScope = globalThis as never,
): void {
  const options: ServeCodeHighlightingOptions = Array.isArray(languagesOrOptions)
    ? { languages: languagesOrOptions }
    : (languagesOrOptions as ServeCodeHighlightingOptions)
  const known = new Map<string, CodeLanguage>()
  const register = (language: CodeLanguage) => {
    for (const [name, item] of languagesIn(language)) {
      if (!known.has(name)) known.set(name, item)
    }
  }
  for (const language of options.languages ?? []) register(language)

  const resolving = new Map<string, Promise<CodeLanguage | null>>()
  const open = new Map<number, Open>()
  /** Texts still coming in. */
  const opening = new Map<
    number,
    { language: CodeLanguage; tabSize: number; mode: WorkerSyntaxMode; lines: string[] }
  >()
  /** Documents waiting for async `options.resolve(name)`. */
  const pendingOpen = new Map<number, PendingOpen>()
  /** Queued diff computations by request id, in FIFO order. */
  const diffTasks = new Map<number, DiffTask>()
  let timer: ReturnType<typeof setTimeout> | null = null

  // a worker's scope answers only the page that started it: there is no origin to name
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  const send = (message: FromWorker) => scope.postMessage(message)

  function targetOf(doc: Open, asked: Asked): number {
    const lineCount = doc.highlighter.text.lines
    const wanted = doc.tokenMode ? Math.max(asked.until, asked.tokensTo ?? 0) : asked.until
    return Math.min(lineCount, Math.max(0, wanted))
  }

  function replyTokens(id: number, doc: Open, asked: Asked) {
    const hl = doc.highlighter
    const total = hl.text.lines
    if (total === 0) {
      send({
        t: 'tokens',
        id,
        version: doc.version,
        seq: asked.seq,
        from: 1,
        lines: [],
        frontier: 0,
      })
      return
    }
    const from = Math.max(1, Math.min(total, asked.tokensFrom ?? 1))
    const to = Math.max(from, Math.min(total, asked.tokensTo ?? asked.until))
    const lines: CodeLineTokens[] = []
    for (let n = from; n <= to; n++) {
      lines.push(hl.line(n) ?? [])
    }
    send({
      t: 'tokens',
      id,
      version: doc.version,
      seq: asked.seq,
      from,
      lines,
      frontier: hl.frontier,
    })
  }

  function reply(id: number, doc: Open) {
    const asked = doc.asked!
    doc.asked = null
    if (doc.tokenMode) {
      replyTokens(id, doc, asked)
      return
    }
    try {
      const points = doc.highlighter
        .checkpoints(asked.from)
        .map(([line, state]) => [line, encodeState(state)] as [number, unknown])
      send({ t: 'states', id, version: doc.version, seq: asked.seq, points })
    } catch {
      // State cannot be structured-cloned (e.g. Shiki StateStack or custom class):
      // switch this document to flat per-line token protocol so it stays off the main thread.
      doc.tokenMode = true
      replyTokens(id, doc, asked)
    }
  }

  function run() {
    timer = null
    const deadline = performance.now() + SLICE

    // 1. Process queued diff tasks first (each is cancellable before it runs).
    for (const [diffId, task] of diffTasks) {
      diffTasks.delete(diffId)
      const hunks = diffText(task.original, task.modified, task.options)
      send({ t: 'diffResult', id: diffId, hunks })
      if (performance.now() >= deadline) break
    }

    // 2. Prioritize documents with an active viewport request.
    if (performance.now() < deadline) {
      for (const [id, doc] of open) {
        if (!doc.asked) continue
        const hl = doc.highlighter
        const target = targetOf(doc, doc.asked)
        if (hl.ready(target)) {
          reply(id, doc)
          continue
        }
        hl.work(deadline, target)
        if (doc.asked && hl.ready(target)) reply(id, doc)
        if (performance.now() >= deadline) break
      }
    }

    // 3. Only when idle (no queued diffs or active viewport requests), read ahead
    //    unpaused state-checkpoint documents so future jumps are instant.
    let hasUrgent = diffTasks.size > 0
    if (!hasUrgent) {
      for (const doc of open.values()) {
        if (doc.asked) {
          hasUrgent = true
          break
        }
      }
    }
    if (!hasUrgent && performance.now() < deadline) {
      for (const doc of open.values()) {
        if (doc.paused || doc.tokenMode) continue
        const hl = doc.highlighter
        if (!hl.ready(hl.text.lines)) {
          hl.work(deadline, hl.text.lines)
          if (performance.now() >= deadline) break
        }
      }
    }

    // Schedule another slice if there is still pending work.
    if (diffTasks.size > 0) {
      schedule()
      return
    }
    for (const doc of open.values()) {
      if (doc.asked) {
        schedule()
        return
      }
      if (!doc.paused && !doc.tokenMode && !doc.highlighter.ready(doc.highlighter.text.lines)) {
        schedule()
        return
      }
    }
  }

  const schedule = () => {
    timer ??= setTimeout(run, 0)
  }

  function resolveLanguage(name: string): Promise<CodeLanguage | null> {
    const existing = known.get(name)
    if (existing) return Promise.resolve(existing)
    const inflight = resolving.get(name)
    if (inflight) return inflight
    if (!options.resolve) return Promise.resolve(null)
    const promise = Promise.resolve()
      .then(() => options.resolve!(name))
      .then(
        (resolved) => {
          resolving.delete(name)
          if (resolved) {
            if (!known.has(name)) known.set(name, resolved)
            register(resolved)
            return resolved
          }
          return null
        },
        () => {
          resolving.delete(name)
          return null
        },
      )
    resolving.set(name, promise)
    return promise
  }

  function openResolved(
    id: number,
    languageName: string,
    language: CodeLanguage | null,
    nested: string[],
    tabSize: number,
    mode: WorkerSyntaxMode,
  ): boolean {
    // the same name with other languages inside (Markdown's fenced code) would read differently
    const inside = language ? languagesIn(language) : null
    const missing = inside ? nested.find((name) => !inside.has(name)) : languageName
    if (!language || missing) {
      send({ t: 'unsupported', id, missing: missing! })
      return false
    }
    opening.set(id, { language, tabSize, mode, lines: [] })
    return true
  }

  function handleMessage(message: ToWorker) {
    if (message.t === 'diff') {
      diffTasks.set(message.id, {
        id: message.id,
        original: message.original,
        modified: message.modified,
        options: message.options,
      })
      schedule()
      return
    }
    if (message.t === 'cancelDiff') {
      diffTasks.delete(message.id)
      return
    }

    if (message.t === 'open') {
      const mode = message.mode ?? 'auto'
      const immediate = known.get(message.language)
      if (immediate || !options.resolve) {
        openResolved(
          message.id,
          message.language,
          immediate ?? null,
          message.nested,
          message.tabSize,
          mode,
        )
        return
      }
      const pending: PendingOpen = {
        nested: message.nested,
        tabSize: message.tabSize,
        mode,
        messages: [],
        closed: false,
      }
      pendingOpen.set(message.id, pending)
      void resolveLanguage(message.language).then((language) => {
        if (pending.closed || pendingOpen.get(message.id) !== pending) return
        pendingOpen.delete(message.id)
        if (
          !openResolved(
            message.id,
            message.language,
            language,
            pending.nested,
            pending.tabSize,
            pending.mode,
          )
        ) {
          return
        }
        for (const buffered of pending.messages) handleMessage(buffered)
      })
      return
    }

    if (message.t === 'close') {
      const waiting = pendingOpen.get(message.id)
      if (waiting) {
        waiting.closed = true
        pendingOpen.delete(message.id)
      }
      open.delete(message.id)
      opening.delete(message.id)
      return
    }

    const waiting = pendingOpen.get(message.id)
    if (waiting) {
      if (message.t === 'read') {
        // Keep only the latest read request while resolving the language.
        waiting.messages = waiting.messages.filter((item) => item.t !== 'read')
      } else if (message.t === 'cancel') {
        waiting.messages = waiting.messages.filter((item) => item.t !== 'read')
      }
      waiting.messages.push(message)
      return
    }

    if (message.t === 'text') {
      const incoming = opening.get(message.id)
      if (!incoming) return
      for (const line of message.lines) incoming.lines.push(line)
      if (!message.done) return
      opening.delete(message.id)
      const tokenMode =
        incoming.mode === 'tokens' ||
        (incoming.mode === 'auto' && incoming.language.workerMode === 'tokens')
      open.set(message.id, {
        highlighter: new CodeHighlighter(incoming.language, CodeText.of(incoming.lines), {
          tabSize: incoming.tabSize,
        }),
        version: 0,
        tokenMode,
        paused: false,
        asked: null,
      })
    } else {
      const doc = open.get(message.id)
      if (!doc) return
      if (message.t === 'change') {
        const changes = ChangeSet.of(
          message.changes.map(([from, to, insert]) => ({ from, to, insert })),
          message.length,
        )
        doc.highlighter.update(changes.apply(doc.highlighter.text), changes)
        doc.version++
      } else if (message.t === 'cancel') {
        doc.asked = null
        doc.paused = true
        return
      } else {
        doc.paused = false
        doc.asked = {
          from: message.from,
          until: message.until,
          tokensFrom: message.tokensFrom,
          tokensTo: message.tokensTo,
          seq: message.seq,
        }
      }
    }
    schedule()
  }

  scope.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as ToWorker
    if (!message || typeof message !== 'object') return
    handleMessage(message)
  })
}
