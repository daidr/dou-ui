import type { ChangeSet } from '../core/changes'
import type { CodeText } from '../core/text'
import type { CodeLanguage } from './language'
import { decodeState, type FromWorker, languagesIn, type ToWorker } from './worker-protocol'

let nextId = 1

/** Lines sent to the worker in one message, so sending a long text never holds up the page long. */
const PIECE = 20_000

/**
 * The editor's side of a highlighting worker (`serveCodeHighlighting`).
 * The text goes over the first time states far ahead are wanted (most
 * texts never need it), in pieces between other work; every change
 * follows it.
 */
export class SyntaxWorkerClient {
  private readonly id = nextId++
  /** Changes sent so far; the worker's answers name how many it had taken in. */
  private version = 0
  private asking = false
  private closed = false
  /** Sending the text: messages wait until it is all there. */
  private sending = false
  private opened = false
  private queue: ToWorker[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly languages: Map<string, CodeLanguage>

  constructor(
    private readonly worker: Worker,
    private readonly language: CodeLanguage,
    /** The text as it is now. */
    private readonly text: () => CodeText,
    private readonly tabSize: number,
    private readonly handlers: {
      states: (points: Array<[line: number, state: unknown]>) => void
      unsupported: () => void
    },
  ) {
    this.languages = languagesIn(language)
  }

  private post(message: ToWorker) {
    if (this.sending) {
      this.queue.push(message)
      return
    }
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker takes no origin
    this.worker.postMessage(message)
  }

  private open() {
    this.opened = true
    this.worker.addEventListener('message', this.listen)
    this.post({ t: 'open', id: this.id, language: this.language.name, tabSize: this.tabSize })
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
      this.handlers.unsupported()
      return
    }
    if (message.t !== 'states') return
    this.asking = false
    // Changed since it was asked: what it read is for another text; asking again gets the new one.
    if (message.version !== this.version) return
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
    this.post({
      t: 'change',
      id: this.id,
      changes: changes.changes.map((change) => [change.from, change.to, change.insert]),
      length: changes.length,
    })
  }

  /** Asks for the states from line index `from` on, once the worker has read up to `until`. */
  want(from: number, until: number): void {
    if (this.closed || this.asking) return
    if (!this.opened) this.open()
    this.asking = true
    this.post({ t: 'read', id: this.id, from, until })
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    if (this.timer) clearTimeout(this.timer)
    if (!this.opened) return
    this.worker.removeEventListener('message', this.listen)
    this.sending = false
    this.queue = []
    this.post({ t: 'close', id: this.id })
  }
}
