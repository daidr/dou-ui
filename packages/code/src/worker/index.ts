import { ChangeSet } from '../core/changes'
import { CodeText } from '../core/text'
import { CodeHighlighter } from '../language/highlighter'
import type { CodeLanguage } from '../language/language'
import {
  encodeState,
  type FromWorker,
  languagesIn,
  type ToWorker,
} from '../language/worker-protocol'

export type { CodeLanguage }
// The languages and how to make one, so a worker needn't load the editor itself.
export { defineCodeLanguage, copyPlain, samePlain } from '../language/language'
export type { CodeLanguageSpec, CodeTokenType } from '../language/language'
export type { CodeStream } from '../language/stream'
export { createJavaScript, javascript, jsx, tsx, typescript } from '../languages/javascript'
export { createCss, css, scss } from '../languages/css'
export { json } from '../languages/json'
export { createHtml, html, vue } from '../languages/html'
export { createMarkdown, markdown } from '../languages/markdown'
export { python } from '../languages/python'
export { shell } from '../languages/shell'
export { sql } from '../languages/sql'
export { yaml } from '../languages/yaml'

interface Open {
  highlighter: CodeHighlighter
  version: number
  /** Asked for: states from `from` once reading reaches `until`. */
  asked: { from: number; until: number } | null
}

/** How long each piece of reading runs before messages are looked at again (ms). */
const SLICE = 50

/**
 * Reads code in a worker for `DouCodeEditor`'s `worker`, so a long file is
 * colored without the page doing the reading. Call it in the worker's own
 * module with the languages the editors use:
 *
 * ```ts
 * // code-worker.ts
 * import { css, serveCodeHighlighting, typescript } from '@dou-ui/code/worker'
 *
 * serveCodeHighlighting([typescript, css])
 * ```
 *
 * One worker serves every editor that is given it. A language works here
 * when its states are plain data (the built-in ones are); those read by
 * the Shiki adapter stay on the page.
 */
export function serveCodeHighlighting(
  languages: readonly CodeLanguage[],
  scope: {
    postMessage(message: unknown): void
    addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  } = globalThis as never,
): void {
  const known = new Map<string, CodeLanguage>()
  for (const language of languages)
    for (const [name, item] of languagesIn(language)) if (!known.has(name)) known.set(name, item)
  const open = new Map<number, Open>()
  /** Texts still coming in. */
  const opening = new Map<number, { language: CodeLanguage; tabSize: number; lines: string[] }>()
  let timer: ReturnType<typeof setTimeout> | null = null

  // a worker's scope answers only the page that started it: there is no origin to name
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  const send = (message: FromWorker) => scope.postMessage(message)

  function reply(id: number, doc: Open) {
    const asked = doc.asked!
    doc.asked = null
    let points: Array<[number, unknown]>
    try {
      points = doc.highlighter
        .checkpoints(asked.from)
        .map(([line, state]) => [line, encodeState(state)])
      send({ t: 'states', id, version: doc.version, points })
    } catch {
      // a state that can't be sent: the page reads this one itself
      open.delete(id)
      send({ t: 'unsupported', id })
    }
  }

  function run() {
    timer = null
    const deadline = performance.now() + SLICE
    for (const [id, doc] of open) {
      const hl = doc.highlighter
      if (doc.asked && hl.ready(doc.asked.until)) reply(id, doc)
      if (performance.now() >= deadline) break
      if (!hl.ready(hl.text.lines)) {
        hl.work(deadline, doc.asked ? doc.asked.until : hl.text.lines)
        if (doc.asked && hl.ready(doc.asked.until)) reply(id, doc)
      }
    }
    for (const doc of open.values())
      if (doc.asked || !doc.highlighter.ready(doc.highlighter.text.lines)) {
        schedule()
        break
      }
  }
  const schedule = () => {
    timer ??= setTimeout(run, 0)
  }

  scope.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as ToWorker
    if (!message || typeof message !== 'object') return
    if (message.t === 'open') {
      const language = known.get(message.language)
      if (!language) {
        send({ t: 'unsupported', id: message.id })
        return
      }
      opening.set(message.id, { language, tabSize: message.tabSize, lines: [] })
      return
    } else if (message.t === 'text') {
      const pending = opening.get(message.id)
      if (!pending) return
      for (const line of message.lines) pending.lines.push(line)
      if (!message.done) return
      opening.delete(message.id)
      open.set(message.id, {
        highlighter: new CodeHighlighter(pending.language, CodeText.of(pending.lines), {
          tabSize: pending.tabSize,
        }),
        version: 0,
        asked: null,
      })
    } else if (message.t === 'close') {
      open.delete(message.id)
      opening.delete(message.id)
      return
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
      } else doc.asked = { from: message.from, until: message.until }
    }
    schedule()
  })
}
