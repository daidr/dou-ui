import { describe, expect, it } from 'vitest'
import { ChangeSet } from '../core/changes'
import { CodeText } from '../core/text'
import { CodeHighlighter } from '../language/highlighter'
import { type CodeLanguage, defineCodeLanguage, tokenizeLine } from '../language/language'
import { SyntaxWorkerClient } from '../language/worker-client'
import { html } from '../languages/html'
import { createMarkdown, markdown } from '../languages/markdown'
import { python } from '../languages/python'
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

  it('leaves states that can’t be sent to the page', async () => {
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
})
