import { h, type VNodeChild } from 'vue'
import type { CodeCommand } from '../core/commands'
import type { CodeText } from '../core/text'
import type { CodeTransactionResult } from '../core/transaction'
import {
  type CodeCompletion,
  type CodeCompletionKind,
  type CodeCompletionResult,
  type CodeDiagnostic,
  type CodeDiagnosticSeverity,
  type CodeExtension,
  type CodeExtensionContext,
  type CodeHoverResult,
  type CodeSignatureResult,
  defineCodeExtension,
} from '../extension'

/** A position as the protocol counts it: line and character (UTF-16 code units), both from 0. */
export interface LspPosition {
  line: number
  character: number
}

export interface LspRange {
  start: LspPosition
  end: LspPosition
}

/** A place in some document, e.g. where a name is defined. */
export interface LspLocation {
  uri: string
  range: LspRange
}

/** A JSON-RPC message: a request, its response, or a notification. */
export interface LspMessage {
  jsonrpc: '2.0'
  id?: number | string | null
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/**
 * How messages reach the server and come back: one JSON-RPC message
 * (an object, not a string) at a time.
 */
export interface LspTransport {
  send: (message: LspMessage) => void
  /** Listens for the server's messages; returns a function that stops listening. */
  onMessage: (listener: (message: LspMessage) => void) => () => void
  /** Ends the connection, e.g. terminates the worker. */
  close?: () => void
}

export interface LanguageClientOptions {
  /**
   * The connection to the server. A function is called when the first
   * editor using the client mounts, and the connection is shut down and
   * closed when the last one unmounts; a later editor starts a new one.
   * A transport given as it is stays open until `close()`.
   */
  transport: LspTransport | (() => LspTransport)
  /** The workspace folder, sent as `rootUri`. */
  rootUri?: string | null
  /** Sent as `initializationOptions`, for what the server reads there. */
  initializationOptions?: unknown
}

export interface LanguageDocumentOptions {
  /** The document's URI, e.g. `file:///src/report.ts`. */
  uri: string
  /** The language's identifier as the server knows it, e.g. `typescript`. */
  languageId: string
  /**
   * Opens a definition in another document (`F12` on a name defined
   * elsewhere). Definitions in this document are selected in place.
   */
  openLocation?: (location: LspLocation) => void
}

export interface LanguageClient {
  /** An extension that opens a document on the server and shows what it says about it. One per editor. */
  document: (options: LanguageDocumentOptions) => CodeExtension
  /** Sends a request once the server is ready; `signal` cancels it (`$/cancelRequest`). */
  request: <T = unknown>(method: string, params?: unknown, signal?: AbortSignal) => Promise<T>
  /** Sends a notification once the server is ready. */
  notify: (method: string, params?: unknown) => void
  /** Listens for one of the server's notifications, e.g. `window/logMessage`; returns a function that stops listening. */
  onNotification: (method: string, listener: (params: any) => void) => () => void
  /** What the server said it can do in its `initialize` answer; `null` until it answered. */
  readonly capabilities: Readonly<Record<string, any>> | null
  /** Shuts the server down and closes the connection. */
  close: () => void
}

const warn = (message: string, error?: unknown) => {
  if (process.env.NODE_ENV === 'production') return
  console.warn(`[@dou-ui/code] ${message}`, ...(error === undefined ? [] : [error]))
}

/** A transport over a Web Worker that runs the server, posting message objects both ways. */
export function workerTransport(worker: Worker): LspTransport {
  return {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no target origin
    send: (message) => worker.postMessage(message),
    onMessage: (listener) => {
      const handle = (event: MessageEvent) => listener(event.data as LspMessage)
      worker.addEventListener('message', handle)
      return () => worker.removeEventListener('message', handle)
    },
    close: () => worker.terminate(),
  }
}

/**
 * A transport over a WebSocket, one JSON message per frame. Messages sent
 * before it opens wait for it.
 */
export function socketTransport(socket: WebSocket): LspTransport {
  const waiting: string[] = []
  socket.addEventListener('open', () => {
    for (const text of waiting.splice(0)) socket.send(text)
  })
  return {
    send: (message) => {
      const text = JSON.stringify(message)
      if (socket.readyState === WebSocket.CONNECTING) waiting.push(text)
      else if (socket.readyState === WebSocket.OPEN) socket.send(text)
    },
    onMessage: (listener) => {
      const handle = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return
        try {
          listener(JSON.parse(event.data) as LspMessage)
        } catch (error) {
          warn('the language server sent a frame that is not JSON', error)
        }
      }
      socket.addEventListener('message', handle)
      return () => socket.removeEventListener('message', handle)
    },
    close: () => socket.close(),
  }
}

/** Offset `pos` as the protocol's line and character. */
export function toLspPosition(doc: CodeText, pos: number): LspPosition {
  const line = doc.lineAt(Math.max(0, Math.min(pos, doc.length)))
  return { line: line.number - 1, character: pos - line.from }
}

/** The offset of a protocol position; past the end of a line or the text, the nearest end. */
export function fromLspPosition(doc: CodeText, position: LspPosition): number {
  if (position.line < 0) return 0
  if (position.line >= doc.lines) return doc.length
  const line = doc.line(position.line + 1)
  return line.from + Math.max(0, Math.min(position.character, line.to - line.from))
}

const CLIENT_CAPABILITIES = {
  general: { positionEncodings: ['utf-16'] },
  textDocument: {
    synchronization: { dynamicRegistration: false, didSave: false },
    completion: {
      contextSupport: true,
      completionItem: {
        snippetSupport: true,
        documentationFormat: ['markdown', 'plaintext'],
        insertReplaceSupport: true,
        labelDetailsSupport: true,
      },
    },
    hover: { contentFormat: ['markdown', 'plaintext'] },
    signatureHelp: {
      signatureInformation: {
        documentationFormat: ['markdown', 'plaintext'],
        parameterInformation: { labelOffsetSupport: true },
        activeParameterSupport: true,
      },
    },
    definition: { linkSupport: true },
    publishDiagnostics: { versionSupport: true },
    diagnostic: { dynamicRegistration: false },
  },
  window: { workDoneProgress: false },
}

/**
 * Talks to a language server: its completions, hover texts, parameter
 * hints, problems and definitions show in the editors that use
 * `client.document(...)`.
 */
export function createLanguageClient(options: LanguageClientOptions): LanguageClient {
  let transport: LspTransport | null = null
  let stopListening: (() => void) | null = null
  let ready: Promise<void> | null = null
  let capabilities: Record<string, any> | null = null
  let users = 0
  let nextId = 0
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: any) => void }>()
  const listeners = new Map<string, Set<(params: any) => void>>()
  const owned = typeof options.transport === 'function'

  const send = (message: Omit<LspMessage, 'jsonrpc'>) =>
    transport?.send({ jsonrpc: '2.0', ...message })

  function rawRequest<T>(method: string, params: unknown, signal?: AbortSignal): Promise<T> {
    const id = ++nextId
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason)
      pending.set(id, { resolve, reject })
      send({ id, method, params })
      signal?.addEventListener(
        'abort',
        () => {
          if (!pending.delete(id)) return
          send({ method: '$/cancelRequest', params: { id } })
          reject(signal.reason)
        },
        { once: true },
      )
    })
  }

  /** What the client answers to the server's own requests: enough that none of them hangs. */
  function answer(message: LspMessage) {
    const { id, method, params } = message
    if (method === 'workspace/configuration') {
      const items = (params as { items?: unknown[] } | undefined)?.items ?? []
      send({ id, result: items.map(() => null) })
    } else if (
      method === 'client/registerCapability' ||
      method === 'client/unregisterCapability' ||
      method === 'window/workDoneProgress/create' ||
      method === 'window/showMessageRequest'
    )
      send({ id, result: null })
    else send({ id, error: { code: -32601, message: `Unhandled method ${method}` } })
  }

  function receive(message: LspMessage) {
    if (message.method !== undefined) {
      if (message.id !== undefined && message.id !== null) answer(message)
      else for (const listener of listeners.get(message.method) ?? []) listener(message.params)
      return
    }
    const waiting = pending.get(message.id as number)
    if (!waiting) return
    pending.delete(message.id as number)
    if (message.error) waiting.reject(message.error)
    else waiting.resolve(message.result ?? null)
  }

  function connect() {
    if (ready) return ready
    transport = typeof options.transport === 'function' ? options.transport() : options.transport
    stopListening = transport.onMessage(receive)
    ready = rawRequest<{ capabilities?: Record<string, any> }>('initialize', {
      processId: null,
      clientInfo: { name: 'DouCodeEditor' },
      rootUri: options.rootUri ?? null,
      capabilities: CLIENT_CAPABILITIES,
      initializationOptions: options.initializationOptions,
    }).then((result) => {
      capabilities = result?.capabilities ?? {}
      send({ method: 'initialized', params: {} })
    })
    ready.catch((error: unknown) => warn('the language server failed to start', error))
    return ready
  }

  function disconnect() {
    if (!transport) return
    const ending = transport
    const stop = stopListening
    const wasReady = ready
    transport = null
    stopListening = null
    ready = null
    capabilities = null
    for (const waiting of pending.values()) waiting.reject(new Error('The language server closed'))
    pending.clear()
    // Ask it to shut down, then exit; a server that doesn't answer is closed all the same.
    const finish = () => {
      ending.send({ jsonrpc: '2.0', method: 'exit' })
      stop?.()
      ending.close?.()
    }
    if (!wasReady) return finish()
    const id = ++nextId
    const timer = setTimeout(finish, 1000)
    const stopShutdown = ending.onMessage((message) => {
      if (message.id !== id || message.method !== undefined) return
      clearTimeout(timer)
      stopShutdown()
      finish()
    })
    ending.send({ jsonrpc: '2.0', id, method: 'shutdown' })
  }

  const request = <T>(method: string, params?: unknown, signal?: AbortSignal) =>
    connect().then(() => rawRequest<T>(method, params, signal))
  const notify = (method: string, params?: unknown) => {
    void connect().then(
      () => send({ method, params }),
      () => {},
    )
  }

  const onNotification = (method: string, listener: (params: any) => void) => {
    let set = listeners.get(method)
    if (!set) listeners.set(method, (set = new Set()))
    set.add(listener)
    return () => set.delete(listener)
  }

  function acquire() {
    users++
    return connect()
  }
  function release() {
    users--
    if (users === 0 && owned) disconnect()
  }

  const client: LanguageClient = {
    document: (documentOptions) =>
      documentExtension(documentOptions, {
        acquire,
        release,
        send: (method, params) => send({ method, params }),
        request: rawRequest,
        onNotification,
        capabilities: () => capabilities,
      }),
    request,
    notify,
    onNotification,
    get capabilities() {
      return capabilities
    },
    close: () => {
      users = 0
      disconnect()
    },
  }
  return client
}

interface Connection {
  acquire: () => Promise<void>
  release: () => void
  /** Sends a notification on the open connection. */
  send: (method: string, params: unknown) => void
  request: <T>(method: string, params: unknown, signal?: AbortSignal) => Promise<T>
  onNotification: (method: string, listener: (params: any) => void) => () => void
  capabilities: () => Record<string, any> | null
}

const SEVERITY: Record<number, CodeDiagnosticSeverity> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
}

const KIND: Record<number, CodeCompletionKind> = {
  1: 'text',
  2: 'method',
  3: 'function',
  4: 'method',
  5: 'property',
  6: 'variable',
  7: 'class',
  8: 'type',
  9: 'module',
  10: 'property',
  11: 'constant',
  12: 'constant',
  13: 'type',
  14: 'keyword',
  15: 'snippet',
  16: 'constant',
  17: 'module',
  18: 'variable',
  19: 'module',
  20: 'constant',
  21: 'constant',
  22: 'class',
  23: 'property',
  24: 'keyword',
  25: 'type',
}

/** `textDocumentSync` as its kind: 0 none, 1 whole text, 2 changes only. */
function syncKind(capabilities: Record<string, any> | null): number {
  const sync = capabilities?.textDocumentSync
  if (typeof sync === 'number') return sync
  if (sync && typeof sync === 'object') return sync.openClose === false ? 0 : (sync.change ?? 0)
  return 0
}

type Markup = string | { kind?: string; language?: string; value: string }

/** Plain text of documentation, for places that show text only. */
function plainText(markup: Markup | Markup[] | null | undefined): string {
  if (!markup) return ''
  if (Array.isArray(markup)) return markup.map(plainText).filter(Boolean).join('\n\n')
  if (typeof markup === 'string') return markup
  return markup.value
}

/** Inline Markdown: `code` and **bold**; other marks are left as typed. */
function inline(text: string): VNodeChild[] {
  const out: VNodeChild[] = []
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let at = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) out.push(text.slice(at, match.index))
    out.push(
      match[1] !== undefined
        ? h('code', { class: 'dou-code-lsp-markup__inline' }, match[1])
        : h('strong', match[2]),
    )
    at = match.index + match[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

/**
 * The server's documentation as content for the hover box: Markdown's code
 * fences become code blocks, `code` and **bold** are kept, the rest shows
 * as text. Nothing is read as HTML.
 */
function lspMarkup(markup: Markup | Markup[]): string | (() => VNodeChild) {
  const list = Array.isArray(markup) ? markup : [markup]
  const blocks: Array<{ code: boolean; text: string }> = []
  for (const part of list) {
    if (typeof part === 'object' && part.language !== undefined) {
      blocks.push({ code: true, text: part.value })
      continue
    }
    const value = typeof part === 'string' ? part : part.value
    if (typeof part === 'object' && part.kind === 'plaintext') {
      blocks.push({ code: false, text: value })
      continue
    }
    const pieces = value.split(/^```[^\n]*\n([\s\S]*?)^```[ \t]*$/m)
    pieces.forEach((piece, index) => blocks.push({ code: index % 2 === 1, text: piece }))
  }
  const kept = blocks
    .map((block) => ({
      ...block,
      text: block.code ? block.text.replace(/\n$/, '') : block.text.trim(),
    }))
    .filter((block) => block.text)
  if (!kept.length) return ''
  if (kept.length === 1 && !kept[0]!.code && !/[`*]/.test(kept[0]!.text)) return kept[0]!.text
  return () =>
    h(
      'div',
      { class: 'dou-code-lsp-markup' },
      kept.map((block) =>
        block.code
          ? h('pre', { class: 'dou-code-lsp-markup__code' }, block.text)
          : h('p', { class: 'dou-code-lsp-markup__text' }, inline(block.text)),
      ),
    )
}

/** The edit's range: the plain one, or the `insert` side of an insert-or-replace edit. */
function editRange(edit: any): LspRange | null {
  if (!edit) return null
  return edit.range ?? edit.insert ?? null
}

/** The first place a definition answer points to. */
function firstLocation(found: any): LspLocation | null {
  const one = Array.isArray(found) ? found[0] : found
  if (!one) return null
  if (one.targetUri)
    return { uri: one.targetUri, range: one.targetSelectionRange ?? one.targetRange }
  return one.uri ? { uri: one.uri, range: one.range } : null
}

function toDiagnostics(doc: CodeText, items: any[]): CodeDiagnostic[] {
  return items.map((item) => {
    const code = item.code === undefined || item.code === null ? '' : String(item.code)
    const source = [item.source, code].filter(Boolean).join(' ')
    return {
      from: fromLspPosition(doc, item.range.start),
      to: fromLspPosition(doc, item.range.end),
      severity: SEVERITY[item.severity as number] ?? 'error',
      message: item.message,
      ...(source ? { source } : {}),
    }
  })
}

function documentExtension(
  options: LanguageDocumentOptions,
  connection: Connection,
): CodeExtension {
  const { uri, languageId } = options
  const textDocument = { uri }
  let version = 0
  let opened = false
  let mounted = false
  /** The problems the server last sent, and for which version. */
  let published: { version: number; items: any[] } | null = null
  let waiting: Array<() => void> = []
  /** For pulled problems: the server's id of the last answer, to get `unchanged` back. */
  let resultId: string | undefined
  let pulled: any[] = []
  let stopDiagnostics: (() => void) | null = null
  let opening: Promise<boolean> | null = null

  const can = (name: string) => !!connection.capabilities()?.[name]

  /** Resolves once the document is open on the server; `false` when the editor went away first or the server failed. */
  function whenOpen(): Promise<boolean> {
    return opening ?? Promise.resolve(false)
  }

  function lint(context: CodeExtensionContext) {
    const doc = context.doc
    return whenOpen().then((open): Promise<CodeDiagnostic[] | null> | CodeDiagnostic[] | null => {
      if (!open || context.doc !== doc) return null
      if (can('diagnosticProvider')) {
        return connection
          .request<any>('textDocument/diagnostic', {
            textDocument,
            ...(resultId ? { previousResultId: resultId } : {}),
          })
          .then((report) => {
            if (report?.kind === 'full') pulled = report.items ?? []
            resultId = report?.resultId
            return toDiagnostics(doc, pulled)
          })
          .catch(() => null)
      }
      // Pushed problems: wait until the server sends them for this version.
      const at = version
      return new Promise<CodeDiagnostic[] | null>((resolve) => {
        const check = () => {
          if (!published || published.version < at) return false
          resolve(published.version === at ? toDiagnostics(doc, published.items) : null)
          return true
        }
        if (check()) return
        const run = () => {
          if (!mounted) resolve(null)
          else if (!check()) waiting.push(run)
        }
        waiting.push(run)
      })
    })
  }

  function openDocument(context: CodeExtensionContext): Promise<boolean> {
    return connection.acquire().then(
      () => {
        if (!mounted) return false
        const sync = syncKind(connection.capabilities())
        version = 1
        opened = sync !== 0
        if (opened)
          connection.send('textDocument/didOpen', {
            textDocument: { uri, languageId, version, text: context.doc.toString() },
          })
        return true
      },
      () => false,
    )
  }

  function update(result: CodeTransactionResult) {
    if (!opened || result.changes.empty) return
    version++
    const sync = syncKind(connection.capabilities())
    let contentChanges: unknown[]
    if (sync === 2) {
      // Each change is in the text before the step: going from the last
      // one back, the earlier positions still hold when each is applied.
      const before = result.before.doc
      const { changes } = result.changes
      contentChanges = []
      for (let i = changes.length - 1; i >= 0; i--) {
        const change = changes[i]!
        contentChanges.push({
          range: {
            start: toLspPosition(before, change.from),
            end: toLspPosition(before, change.to),
          },
          text: change.insert,
        })
      }
    } else contentChanges = [{ text: result.state.doc.toString() }]
    connection.send('textDocument/didChange', { textDocument: { uri, version }, contentChanges })
  }

  async function completion(
    request: Parameters<NonNullable<CodeExtension['completion']>>[0],
    context: CodeExtensionContext,
  ): Promise<CodeCompletionResult | null> {
    if (!(await whenOpen()) || !can('completionProvider') || request.signal.aborted) return null
    const doc = context.doc
    const triggers: string[] =
      connection.capabilities()?.completionProvider?.triggerCharacters ?? []
    const before = request.pos > 0 ? doc.slice(request.pos - 1, request.pos) : ''
    const triggerContext =
      !request.explicit && triggers.includes(before)
        ? { triggerKind: 2, triggerCharacter: before }
        : { triggerKind: 1 }
    let found: any
    try {
      found = await connection.request(
        'textDocument/completion',
        { textDocument, position: toLspPosition(doc, request.pos), context: triggerContext },
        request.signal,
      )
    } catch {
      return null
    }
    const items: any[] = Array.isArray(found) ? found : (found?.items ?? [])
    if (!items.length) return null
    const defaults = Array.isArray(found) ? undefined : found?.itemDefaults
    let from = request.word.from
    const firstEdit = editRange(
      items.find((item) => item.textEdit)?.textEdit ?? defaults?.editRange,
    )
    if (firstEdit) from = Math.min(fromLspPosition(doc, firstEdit.start), request.pos)
    // The server's own order breaks ties among equally good matches.
    const order = items
      .map((item, index) => ({ key: String(item.sortText ?? item.label), index }))
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index))
    const rank = new Map(order.map((entry, at) => [entry.index, at]))
    const entries = items.map((item, index): CodeCompletion => {
      const text: string = item.textEdit?.newText ?? item.insertText ?? item.label
      const format = item.insertTextFormat ?? defaults?.insertTextFormat
      const detail = [item.labelDetails?.detail, item.detail ?? item.labelDetails?.description]
        .filter(Boolean)
        .join(' ')
      const info = plainText(item.documentation)
      const option: CodeCompletion = {
        label: item.label,
        boost: (items.length - rank.get(index)!) / items.length + (item.preselect ? 5 : 0),
      }
      const kind = KIND[item.kind as number]
      if (kind) option.kind = kind
      if (detail) option.detail = detail
      if (info) option.info = info
      if (format === 2) option.snippet = text
      else if (text !== item.label) option.insert = text
      return option
    })
    return { from, options: entries }
  }

  async function hover(
    request: { pos: number; signal: AbortSignal },
    context: CodeExtensionContext,
  ): Promise<CodeHoverResult | null> {
    if (!(await whenOpen()) || !can('hoverProvider') || request.signal.aborted) return null
    const doc = context.doc
    let found: any
    try {
      found = await connection.request(
        'textDocument/hover',
        { textDocument, position: toLspPosition(doc, request.pos) },
        request.signal,
      )
    } catch {
      return null
    }
    if (!found?.contents) return null
    const content = lspMarkup(found.contents)
    if (!content) return null
    const result: CodeHoverResult = { content }
    if (found.range) {
      result.from = fromLspPosition(doc, found.range.start)
      result.to = fromLspPosition(doc, found.range.end)
    }
    return result
  }

  async function signature(
    request: { pos: number; signal: AbortSignal },
    context: CodeExtensionContext,
  ): Promise<CodeSignatureResult | null> {
    if (!(await whenOpen()) || !can('signatureHelpProvider') || request.signal.aborted) return null
    let found: any
    try {
      found = await connection.request(
        'textDocument/signatureHelp',
        { textDocument, position: toLspPosition(context.doc, request.pos) },
        request.signal,
      )
    } catch {
      return null
    }
    const one = found?.signatures?.[found.activeSignature ?? 0] ?? found?.signatures?.[0]
    if (!one) return null
    const label: string = one.label
    let searchFrom = 0
    const params: Array<[number, number]> = (one.parameters ?? []).map((param: any) => {
      if (Array.isArray(param.label)) return [param.label[0], param.label[1]] as [number, number]
      const at = label.indexOf(param.label, searchFrom)
      if (at < 0) return [0, 0] as [number, number]
      searchFrom = at + param.label.length
      return [at, searchFrom] as [number, number]
    })
    const result: CodeSignatureResult = {
      label,
      params,
      active: one.activeParameter ?? found.activeParameter ?? 0,
    }
    const info = plainText(one.documentation)
    if (info) result.info = info
    return result
  }

  function goToDefinition(context: CodeExtensionContext): CodeCommand {
    return (target) => {
      if (!opened || !can('definitionProvider')) return false
      const doc = target.state.doc
      const head = target.state.selection.ranges[target.state.selection.main]!.head
      connection
        .request<any>('textDocument/definition', {
          textDocument,
          position: toLspPosition(doc, head),
        })
        .then((found) => {
          const location = firstLocation(found)
          if (!location || !mounted) return
          if (location.uri !== uri) return options.openLocation?.(location)
          // Moved on meanwhile: the answer is about a text that is gone.
          if (context.doc !== doc) return
          context.select(fromLspPosition(doc, location.range.start))
        })
        .catch(() => {})
      return true
    }
  }

  return defineCodeExtension({
    name: `lsp:${uri}`,
    get completionTriggers() {
      return connection.capabilities()?.completionProvider?.triggerCharacters ?? []
    },
    keymap: (context) => ({ F12: goToDefinition(context) }),
    update,
    lint,
    completion,
    hover,
    signature,
    setup(context) {
      if (mounted)
        warn(
          `the document ${uri} is used by two editors at once; give each its own client.document()`,
        )
      mounted = true
      published = null
      resultId = undefined
      pulled = []
      stopDiagnostics = connection.onNotification('textDocument/publishDiagnostics', (params) => {
        if (params?.uri !== uri) return
        published = { version: params.version ?? version, items: params.diagnostics ?? [] }
        const runs = waiting
        waiting = []
        for (const run of runs) run()
      })
      opening = openDocument(context)
      return () => {
        mounted = false
        stopDiagnostics?.()
        stopDiagnostics = null
        const runs = waiting
        waiting = []
        for (const run of runs) run()
        if (opened) connection.send('textDocument/didClose', { textDocument })
        opened = false
        opening = null
        connection.release()
      }
    },
  })
}
