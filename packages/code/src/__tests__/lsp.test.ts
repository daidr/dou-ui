import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { CodeText, type CodeEditorExpose, type CodeExtension, DouCodeEditor } from '../index'
import {
  createLanguageClient,
  fromLspPosition,
  type LspMessage,
  type LspTransport,
  toLspPosition,
} from '../lsp'

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

/** A fake server: records what it gets, answers requests from `answers`. */
function fakeServer(
  capabilities: Record<string, unknown>,
  answers: Record<string, (params: any) => unknown> = {},
) {
  const received: LspMessage[] = []
  let listener: ((message: LspMessage) => void) | null = null
  let closed = false
  const push = (message: Omit<LspMessage, 'jsonrpc'>) =>
    queueMicrotask(() => listener?.({ jsonrpc: '2.0', ...message }))
  const transport: LspTransport = {
    send(message) {
      received.push(message)
      if (message.id === undefined || message.method === undefined) return
      if (message.method === 'initialize') return push({ id: message.id, result: { capabilities } })
      if (message.method === 'shutdown') return push({ id: message.id, result: null })
      const answer = answers[message.method]
      push({ id: message.id, result: answer ? answer(message.params) : null })
    },
    onMessage(fn) {
      listener = fn
      return () => (listener = null)
    },
    close: () => (closed = true),
  }
  const methods = () => received.map((message) => message.method)
  const last = (method: string) => received.filter((message) => message.method === method).pop()
  return { transport, received, methods, last, push, isClosed: () => closed }
}

function setup(extensions: CodeExtension[], initial: string) {
  const code = ref(initial)
  const editor = ref<CodeEditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouCodeEditor, {
          ref: editor,
          modelValue: code.value,
          'onUpdate:modelValue': (value: string) => (code.value = value),
          extensions,
        }),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea').element as HTMLTextAreaElement
  input.focus()
  return { wrapper, code, editor, input }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('positions', () => {
  it('converts offsets to lines and characters and back', () => {
    const doc = CodeText.of('ab\ncdé\n')
    expect(toLspPosition(doc, 4)).toEqual({ line: 1, character: 1 })
    expect(fromLspPosition(doc, { line: 1, character: 1 })).toBe(4)
    expect(fromLspPosition(doc, { line: 0, character: 99 })).toBe(2)
    expect(fromLspPosition(doc, { line: 9, character: 0 })).toBe(doc.length)
  })
})

describe('createLanguageClient', () => {
  const full = {
    textDocumentSync: { openClose: true, change: 2 },
    completionProvider: { triggerCharacters: ['.'] },
    hoverProvider: true,
    signatureHelpProvider: {},
    definitionProvider: true,
  }

  it('initializes, opens the document and sends changes only', async () => {
    const server = fakeServer(full)
    const client = createLanguageClient({ transport: () => server.transport })
    const doc = client.document({ uri: 'file:///a.js', languageId: 'javascript' })
    const { editor, wrapper } = setup([doc], 'one\ntwo')
    await flush()
    expect(server.methods().slice(0, 3)).toEqual([
      'initialize',
      'initialized',
      'textDocument/didOpen',
    ])
    expect(server.last('textDocument/didOpen')!.params).toEqual({
      textDocument: { uri: 'file:///a.js', languageId: 'javascript', version: 1, text: 'one\ntwo' },
    })
    editor.value!.transact((tr) => {
      tr.replace(0, 1, 'O')
      tr.replace(4, 7, 'TWO!')
    })
    const change = server.last('textDocument/didChange')!.params as any
    expect(change.textDocument).toEqual({ uri: 'file:///a.js', version: 2 })
    // Last change first, so each range still holds when applied in order.
    expect(change.contentChanges).toEqual([
      { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } }, text: 'TWO!' },
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, text: 'O' },
    ])
    wrapper.unmount()
    await flush()
    expect(server.methods()).toContain('textDocument/didClose')
    expect(server.methods().slice(-2)).toEqual(['shutdown', 'exit'])
    expect(server.isClosed()).toBe(true)
  })

  it('sends the whole text when the server takes no changes', async () => {
    const server = fakeServer({ textDocumentSync: 1 })
    const client = createLanguageClient({ transport: server.transport })
    const { editor, wrapper } = setup(
      [client.document({ uri: 'file:///a', languageId: 'x' })],
      'ab',
    )
    await flush()
    editor.value!.transact((tr) => tr.replace(2, 2, 'c'))
    expect((server.last('textDocument/didChange')!.params as any).contentChanges).toEqual([
      { text: 'abc' },
    ])
    wrapper.unmount()
    await flush()
    // A transport given as it is stays open.
    expect(server.methods()).not.toContain('shutdown')
  })

  it('shows the problems the server pushes for the current version', async () => {
    const server = fakeServer(full)
    const client = createLanguageClient({ transport: server.transport })
    const { editor } = setup([client.document({ uri: 'file:///a', languageId: 'x' })], 'let x = y')
    await flush()
    server.push({
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: 'file:///a',
        version: 1,
        diagnostics: [
          {
            range: { start: { line: 0, character: 8 }, end: { line: 0, character: 9 } },
            severity: 2,
            source: 'demo',
            code: 'E1',
            message: 'y is not defined',
          },
        ],
      },
    })
    await flush()
    expect(editor.value!.diagnostics).toEqual([
      { from: 8, to: 9, severity: 'warning', message: 'y is not defined', source: 'demo E1' },
    ])
  })

  it('pulls problems when the server offers it', async () => {
    const server = fakeServer(
      { ...full, diagnosticProvider: {} },
      {
        'textDocument/diagnostic': () => ({
          kind: 'full',
          items: [
            {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
              message: 'bad',
            },
          ],
        }),
      },
    )
    const client = createLanguageClient({ transport: server.transport })
    const { editor } = setup([client.document({ uri: 'file:///a', languageId: 'x' })], 'let')
    await flush()
    expect(editor.value!.diagnostics).toMatchObject([
      { from: 0, to: 3, severity: 'error', message: 'bad' },
    ])
  })

  it('maps completions, hover and signatures', async () => {
    const server = fakeServer(full, {
      'textDocument/completion': () => ({
        isIncomplete: false,
        items: [
          { label: 'zeta', kind: 3, sortText: '2', insertText: 'zeta($1)', insertTextFormat: 2 },
          {
            label: 'alpha',
            kind: 6,
            sortText: '1',
            detail: 'number',
            documentation: { kind: 'markdown', value: 'The **first**.' },
            textEdit: {
              range: { start: { line: 0, character: 4 }, end: { line: 0, character: 6 } },
              newText: 'alpha',
            },
          },
        ],
      }),
      'textDocument/hover': () => ({
        contents: { kind: 'markdown', value: '```ts\nconst a: number\n```\nA `number`.' },
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
      }),
      'textDocument/signatureHelp': () => ({
        signatures: [
          {
            label: 'sum(a: number, b: number)',
            parameters: [{ label: 'a: number' }, { label: [15, 24] }],
            documentation: 'Adds.',
          },
        ],
        activeParameter: 1,
      }),
    })
    const client = createLanguageClient({ transport: server.transport })
    const doc = client.document({ uri: 'file:///a', languageId: 'x' })
    const { editor } = setup([doc], 'foo.al')
    await flush()
    const signal = new AbortController().signal
    const context = editor.value as any
    const completions = await doc.completion!(
      { pos: 6, word: { from: 4, to: 6, text: 'al' }, explicit: false, signal },
      context,
    )
    expect(completions!.from).toBe(4)
    expect(completions!.options).toMatchObject([
      { label: 'zeta', kind: 'function', snippet: 'zeta($1)' },
      { label: 'alpha', kind: 'variable', detail: 'number', info: 'The **first**.' },
    ])
    // Server order breaks ties: alpha (sortText 1) above zeta.
    expect(completions!.options[1]!.boost!).toBeGreaterThan(completions!.options[0]!.boost!)
    expect((server.last('textDocument/completion')!.params as any).context).toEqual({
      triggerKind: 1,
    })
    expect(doc.completionTriggers).toEqual(['.'])

    const hover = await doc.hover!({ pos: 1, signal }, context)
    expect(hover).toMatchObject({ from: 0, to: 3 })
    expect(typeof hover!.content).toBe('function')
    const rendered = mount(defineComponent(() => hover!.content as () => any))
    expect(rendered.find('pre').text()).toBe('const a: number')
    expect(rendered.find('code').text()).toBe('number')

    expect(await doc.signature!({ pos: 1, signal }, context)).toEqual({
      label: 'sum(a: number, b: number)',
      params: [
        [4, 13],
        [15, 24],
      ],
      active: 1,
      info: 'Adds.',
    })
  })

  it('cancels a request whose signal aborts', async () => {
    const server = fakeServer(full)
    const client = createLanguageClient({ transport: server.transport })
    const doc = client.document({ uri: 'file:///a', languageId: 'x' })
    const { editor } = setup([doc], 'abc')
    await flush()
    const abort = new AbortController()
    // Hold the answer back so the abort comes first.
    const send = server.transport.send
    server.transport.send = (message) => {
      if (message.method === 'textDocument/hover') server.received.push(message)
      else send(message)
    }
    const found = doc.hover!({ pos: 1, signal: abort.signal }, editor.value as any)
    await flush()
    abort.abort()
    expect(await found).toBeNull()
    const id = server.last('textDocument/hover')!.id
    expect(server.last('$/cancelRequest')!.params).toEqual({ id })
  })

  it('goes to a definition with F12', async () => {
    const opened: unknown[] = []
    const server = fakeServer(full, {
      'textDocument/definition': (params) =>
        params.position.character === 9
          ? [
              {
                targetUri: 'file:///a',
                targetRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 9 } },
                targetSelectionRange: {
                  start: { line: 0, character: 6 },
                  end: { line: 0, character: 7 },
                },
              },
            ]
          : {
              uri: 'file:///b',
              range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } },
            },
    })
    const client = createLanguageClient({ transport: server.transport })
    const { editor, input } = setup(
      [
        client.document({
          uri: 'file:///a',
          languageId: 'x',
          openLocation: (location) => opened.push(location),
        }),
      ],
      'const x = 1\nx',
    )
    await flush()
    const press = () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F12', bubbles: true, cancelable: true }),
      )
    editor.value!.select(9)
    press()
    await flush()
    expect(editor.value!.selection.ranges[0]!.head).toBe(6)
    editor.value!.select(13)
    press()
    await flush()
    expect(opened).toEqual([
      {
        uri: 'file:///b',
        range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } },
      },
    ])
  })

  it('answers the server’s own requests so it never waits', async () => {
    const server = fakeServer(full)
    const client = createLanguageClient({ transport: server.transport })
    setup([client.document({ uri: 'file:///a', languageId: 'x' })], '')
    await flush()
    server.push({ id: 'c1', method: 'workspace/configuration', params: { items: [{}, {}] } })
    server.push({ id: 'c2', method: 'custom/unknown' })
    await flush()
    expect(server.received.find((m) => m.id === 'c1')).toMatchObject({ result: [null, null] })
    expect(server.received.find((m) => m.id === 'c2')).toMatchObject({ error: { code: -32601 } })
  })
})
