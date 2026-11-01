import { describe, expect, it } from 'vitest'
import { ChangeSet } from '../core/changes'
import { CodeText } from '../core/text'
import { CodeHighlighter } from '../language/highlighter'
import { defineCodeLanguage, tokenizeLine } from '../language/language'
import { SyntaxWorkerClient } from '../language/worker-client'
import { html } from '../languages/html'
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
  const worker = {
    postMessage: (data: unknown) => deliver(workerListeners, data),
    addEventListener: (_: string, listener: (event: MessageEvent) => void) =>
      pageListeners.add(listener),
    removeEventListener: (_: string, listener: (event: MessageEvent) => void) =>
      pageListeners.delete(listener),
  } as unknown as Worker
  const scope = {
    postMessage: (data: unknown) => deliver(pageListeners, data),
    addEventListener: (_: string, listener: (event: MessageEvent) => void) =>
      workerListeners.add(listener),
  }
  return { worker, scope }
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

function connect(doc: CodeText, worker: Worker) {
  const hl = new CodeHighlighter(html, doc)
  const text = () => hl.text
  let resolve: (() => void) | null = null
  let unsupported = false
  const client = new SyntaxWorkerClient(worker, html, text, 2, {
    states(points) {
      hl.adopt(points as Array<[number, never]>)
      resolve?.()
    },
    unsupported() {
      unsupported = true
      resolve?.()
    },
  })
  const want = (until: number) =>
    new Promise<void>((done) => {
      resolve = done
      client.want(hl.frontier, until)
    })
  return { hl, client, want, isUnsupported: () => unsupported }
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

  it('says so for a language it wasn’t given', async () => {
    const { worker, scope } = pair()
    serveCodeHighlighting([], scope)
    const { want, isUnsupported } = connect(CodeText.of(page), worker)
    await want(100)
    expect(isUnsupported()).toBe(true)
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
      })
      client.want(hl.frontier, 2)
    })
    expect(unsupported).toBe(true)
  })
})
