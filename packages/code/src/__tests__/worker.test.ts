import { describe, expect, it, vi } from 'vitest'
import { createHighlighter } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { ChangeSet } from '../core/changes'
import { diffText } from '../core/diff'
import { CodeText } from '../core/text'
import { CodeHighlighter } from '../language/highlighter'
import {
  type CodeLanguage,
  type CodeLineTokens,
  defineCodeLanguage,
  remoteCodeLanguage,
  tokenizeLine,
} from '../language/language'
import { RemoteTokenStore } from '../language/remote-tokens'
import {
  acquirePoolWorker,
  createCodeWorkerPool,
  requestWorkerDiff,
  SyntaxWorkerClient,
} from '../language/worker-client'
import { html } from '../languages/html'
import { createMarkdown, markdown } from '../languages/markdown'
import { python } from '../languages/python'
import { createShikiLanguageResolver, shikiLanguage } from '../shiki'
import { serveCodeHighlighting } from '../worker'

/** A worker and the page, in one thread: messages are copied as postMessage copies them. */
function deliver(to: Set<(event: MessageEvent) => void>, data: unknown) {
  // copied right away, so what can't be copied throws where it is sent
  const copy = structuredClone(data)
  setTimeout(() => {
    for (const listener of to) listener({ data: copy } as MessageEvent)
  })
}

function pair() {
  const pageListeners = new Set<(event: MessageEvent) => void>()
  const workerListeners = new Set<(event: MessageEvent) => void>()
  const errorListeners = new Set<(event: Event) => void>()
  const worker = {
    postMessage: (data: unknown) => deliver(workerListeners, data),
    addEventListener: (type: string, listener: (event: MessageEvent) => void) =>
      (type === 'error' ? errorListeners : pageListeners).add(listener),
    removeEventListener: (type: string, listener: (event: MessageEvent) => void) =>
      (type === 'error' ? errorListeners : pageListeners).delete(listener),
    terminate: vi.fn<() => void>(),
  } as unknown as Worker
  const scope = {
    postMessage: (data: unknown) => deliver(pageListeners, data),
    addEventListener: (_: string, listener: (event: MessageEvent) => void) =>
      workerListeners.add(listener),
  }
  const fail = () => {
    for (const listener of errorListeners) listener(new Event('error'))
  }
  return { worker, scope, fail }
}

const page = Array.from({ length: 400 }, (_, i) =>
  i % 40 === 0
    ? '<script lang="ts">'
    : i % 40 === 20
      ? '</script>'
      : i % 40 < 20
        ? `  const v${i}: number = ${i} /* ${i} */`
        : `<p class="a">第 ${i} 段 <b>{{ x }}</b></p>`,
).join('\n')

function fresh(doc: CodeText) {
  const state = html.startState()
  return Array.from({ length: doc.lines }, (_, i) =>
    tokenizeLine(html, doc.line(i + 1).text, state),
  )
}

function connect(doc: CodeText, worker: Worker, language: CodeLanguage = html) {
  const hl = new CodeHighlighter(language, doc)
  const text = () => hl.text
  let resolve: (() => void) | null = null
  let missing: string | null = null
  let failed = false
  const client = new SyntaxWorkerClient(worker, language, text, 2, {
    states(points) {
      hl.adopt(points as Array<[number, never]>)
      resolve?.()
    },
    unsupported(name) {
      missing = name ?? ''
      resolve?.()
    },
    failed() {
      failed = true
      resolve?.()
    },
  })
  const want = (until: number) =>
    new Promise<void>((done) => {
      resolve = done
      client.want(hl.frontier, until)
    })
  return {
    hl,
    client,
    want,
    missing: () => missing,
    isUnsupported: () => missing !== null,
    isFailed: () => failed,
  }
}

describe('serveCodeHighlighting', () => {
  it('reads far ahead in the worker, languages inside states and all', async () => {
    const { worker, scope } = pair()
    serveCodeHighlighting([html], scope)
    let doc = CodeText.of(page)
    const { hl, client, want } = connect(doc, worker)
    await want(390)
    expect(hl.frontier).toBeGreaterThanOrEqual(390)
    expect(Array.from({ length: doc.lines }, (_, i) => hl.line(i + 1))).toEqual(fresh(doc))

    // an edit at the top: the page reads it, the worker hears of it
    const changes = ChangeSet.of([{ from: 0, to: 0, insert: '<!--\n' }], doc.length)
    doc = changes.apply(doc)
    hl.update(doc, changes)
    client.change(changes)
    hl.line(3)
    await want(doc.lines)
    expect(Array.from({ length: doc.lines }, (_, i) => hl.line(i + 1))).toEqual(fresh(doc))
    client.dispose()
  })

  it('says so for a language it wasn’t given, naming it', async () => {
    const { worker, scope } = pair()
    serveCodeHighlighting([], scope)
    const { want, missing } = connect(CodeText.of(page), worker)
    await want(100)
    expect(missing()).toBe('html')
  })

  it('says so for a language of the same name holding other languages', async () => {
    const { worker, scope } = pair()
    // the worker's Markdown highlights no fenced code; the page's highlights Python
    serveCodeHighlighting([markdown], scope)
    const withPython = createMarkdown({ languages: [python] })
    const { want, missing } = connect(CodeText.of('```python\nx = 1\n```'), worker, withPython)
    await want(3)
    expect(missing()).toBe('python')
  })

  it('says so when the worker fails', async () => {
    const { worker, fail } = pair()
    const { want, isFailed } = connect(CodeText.of(page), worker)
    const asked = want(100)
    fail()
    await asked
    expect(isFailed()).toBe(true)
  })

  it('falls back to unsupported when states cannot cross and caller handles states only', async () => {
    const { worker, scope } = pair()
    const odd = defineCodeLanguage<{ f: () => void }>({
      name: 'odd',
      startState: () => ({ f: () => {} }),
      copyState: (state) => ({ ...state }),
      sameState: () => true,
      token: (stream) => (stream.skipToEnd(), null),
    })
    serveCodeHighlighting([odd], scope)
    const hl = new CodeHighlighter(odd, CodeText.of('a\nb'))
    let unsupported = false
    await new Promise<void>((done) => {
      const client = new SyntaxWorkerClient(worker, odd, () => hl.text, 2, {
        states: () => done(),
        unsupported: () => ((unsupported = true), done()),
        failed: () => done(),
      })
      client.want(hl.frontier, 2)
    })
    expect(unsupported).toBe(true)
  })

  it('automatically switches non-serializable state languages to flat line tokens', async () => {
    const { worker, scope } = pair()
    const odd = defineCodeLanguage<{ f: () => void; inBlock: boolean }>({
      name: 'odd-block',
      startState: () => ({ f: () => {}, inBlock: false }),
      copyState: (state) => ({ ...state }),
      sameState: (a, b) => a.inBlock === b.inBlock,
      token(stream, state) {
        if (state.inBlock) {
          if (stream.match(/^.*\*\//)) state.inBlock = false
          else stream.skipToEnd()
          return 'comment'
        }
        if (stream.match(/^\/\*/)) {
          state.inBlock = true
          return 'comment'
        }
        if (stream.match(/^[a-z]+/)) return 'keyword'
        stream.next()
        return null
      },
    })
    serveCodeHighlighting([odd], scope)
    const doc = CodeText.of('let x\n/* start\ninside\nend */\nlet y')
    const expected = new CodeHighlighter(odd, doc)
    const received = new Map<number, CodeLineTokens>()
    await new Promise<void>((done) => {
      const client = new SyntaxWorkerClient(worker, odd, () => doc, 2, {
        states: () => {},
        tokens(from, lines) {
          lines.forEach((line, idx) => received.set(from + idx, line))
          client.dispose()
          done()
        },
        unsupported: () => done(),
        failed: () => done(),
      })
      client.want(0, 5, 2, 5)
    })
    expect(received.size).toBe(4)
    for (let n = 2; n <= 5; n++) {
      expect(received.get(n)).toEqual(expected.line(n))
    }
  })

  it('highlights Shiki languages off the main thread via lazy resolver and flat tokens', async () => {
    const { worker, scope } = pair()
    const rustSource = [
      '/* block',
      '   comment */',
      'fn greet(name: &str) -> String {',
      '    let count: u32 = 42;',
      '    format!("hello {} {}", name, count)',
      '}',
    ].join('\n')

    const shiki = await createHighlighter({
      langs: ['rust'],
      themes: [],
      engine: createJavaScriptRegexEngine(),
    })
    const localRust = shikiLanguage(shiki, 'rust')
    let doc = CodeText.of(rustSource)
    const expectedBefore = new CodeHighlighter(localRust, doc)

    const resolveSpy = vi.fn<(name: string) => Promise<CodeLanguage | null>>(
      createShikiLanguageResolver({
        highlighter: () => shiki,
      }),
    )
    serveCodeHighlighting({ resolve: resolveSpy }, scope)

    const remoteRust = remoteCodeLanguage({ name: 'rust', comment: { line: '//' } })
    const store = new RemoteTokenStore()
    let onTokens: (() => void) | null = null
    const client = new SyntaxWorkerClient(worker, remoteRust, () => doc, 2, {
      states: () => {},
      tokens(from, lines, frontier) {
        store.adopt(from, lines, frontier)
        onTokens?.()
      },
      unsupported: () => onTokens?.(),
      failed: () => onTokens?.(),
    })

    const request = (from: number, to: number) =>
      new Promise<void>((done) => {
        onTokens = done
        client.want(store.frontier, to, from, to)
      })

    await request(1, doc.lines)
    expect(resolveSpy).toHaveBeenCalledWith('rust')
    expect(store.readyRange(1, doc.lines)).toBe(true)
    for (let n = 1; n <= doc.lines; n++) {
      expect(store.line(n)).toEqual(expectedBefore.line(n))
    }

    // Edit the document and verify incremental off-thread re-tokenization matches local Shiki.
    const changes = ChangeSet.of([{ from: 0, to: 0, insert: '// header\n' }], doc.length)
    const prev = doc
    doc = changes.apply(doc)
    store.update(prev, doc, changes)
    client.change(changes)
    await request(1, doc.lines)
    const expectedAfter = new CodeHighlighter(localRust, doc)
    for (let n = 1; n <= doc.lines; n++) {
      expect(store.line(n)).toEqual(expectedAfter.line(n))
    }
    client.dispose()
  })

  it('cancels pending highlighting tasks and resumes when requested again', async () => {
    const { worker, scope } = pair()
    serveCodeHighlighting([html], scope)
    const doc = CodeText.of(page)
    let replies = 0
    let doneResume: (() => void) | null = null
    const client = new SyntaxWorkerClient(worker, html, () => doc, 2, {
      states() {
        replies++
        doneResume?.()
      },
      unsupported: () => {},
      failed: () => {},
    })

    // Immediately cancel before the worker slice executes.
    client.want(0, 350, 300, 350)
    client.cancel()
    await new Promise((r) => setTimeout(r, 40))
    expect(replies).toBe(0)

    // Request again after returning to viewport.
    await new Promise<void>((done) => {
      doneResume = done
      client.want(0, 350, 300, 350)
    })
    expect(replies).toBe(1)
    client.dispose()
  })

  it('computes diffText asynchronously in the worker and supports cancellation', async () => {
    const { worker, scope } = pair()
    serveCodeHighlighting([], scope)
    const a = 'alpha\nbeta\ngamma\ndelta'
    const b = 'alpha\nbeta two\ndelta\nepsilon'

    const cancelled = requestWorkerDiff(worker, a, b)
    cancelled.cancel()
    const active = requestWorkerDiff(worker, a, b, { words: true })
    const hunks = await active.promise
    expect(hunks).toEqual(diffText(a, b, { words: true }))
  })
})

describe('RemoteTokenStore', () => {
  it('keeps lines before edits fresh and shifts lines after edits without flashing', () => {
    const store = new RemoteTokenStore(10)
    const doc1 = CodeText.of('l1\nl2\nl3\nl4\nl5')
    store.adopt(
      1,
      [
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3],
        [2, 4],
      ],
      5,
    )
    expect(store.readyRange(1, 5)).toBe(true)

    // Insert a newline on line 3: lines 1–2 stay fresh, lines 4–5 shift to 5–6 as temporary colors.
    const changes = ChangeSet.of([{ from: 6, to: 6, insert: 'new\n' }], doc1.length)
    const doc2 = changes.apply(doc1)
    store.update(doc1, doc2, changes)
    expect(store.readyRange(1, 2)).toBe(true)
    expect(store.line(1)).toEqual([2, 0])
    expect(store.line(2)).toEqual([2, 1])
    expect(store.readyRange(4, 6)).toBe(false)
    expect(store.line(5)).toEqual([2, 3])
    expect(store.line(6)).toEqual([2, 4])
  })
})

describe('createCodeWorkerPool', () => {
  it('lazily spawns workers up to maxWorkers, reuses idle workers, recovers from errors and disposes', async () => {
    vi.useFakeTimers()
    try {
      const created: Array<{
        worker: Worker
        fail: () => void
        terminate: ReturnType<typeof vi.fn>
      }> = []
      const pool = createCodeWorkerPool(
        () => {
          const { worker, fail } = pair()
          const terminate = worker.terminate as unknown as ReturnType<typeof vi.fn>
          created.push({ worker, fail, terminate })
          return worker
        },
        { maxWorkers: 2, idleTimeout: 500 },
      )

      // Lazy: 0 workers until acquired.
      expect(pool.size).toBe(0)
      expect(pool.maxWorkers).toBe(2)

      const a = await acquirePoolWorker(pool)
      expect(pool.size).toBe(1)
      a.setBusy?.(true)

      const b = await acquirePoolWorker(pool)
      expect(pool.size).toBe(2)
      expect(b.worker).not.toBe(a.worker)

      // At capacity: reuses least-loaded worker (b has activeTasks=0, a has activeTasks=1).
      const c = await acquirePoolWorker(pool)
      expect(pool.size).toBe(2)
      expect(c.worker).toBe(b.worker)

      // Release a -> becomes idle and warm; next acquire reuses a without spawning.
      a.release()
      const d = await acquirePoolWorker(pool)
      expect(d.worker).toBe(a.worker)
      expect(created).toHaveLength(2)

      // Error evicts the failed slot and next acquire spawns a replacement.
      created[0]!.fail()
      expect(created[0]!.terminate).toHaveBeenCalledTimes(1)
      expect(pool.size).toBe(1)
      d.release()

      const e = await acquirePoolWorker(pool)
      expect(created).toHaveLength(3)
      expect(pool.size).toBe(2)

      // Release all and advance idleTimeout -> terminates idle workers.
      b.release()
      c.release()
      e.release()
      vi.advanceTimersByTime(600)
      expect(pool.size).toBe(0)
      expect(created[1]!.terminate).toHaveBeenCalledTimes(1)
      expect(created[2]!.terminate).toHaveBeenCalledTimes(1)

      pool.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
})
