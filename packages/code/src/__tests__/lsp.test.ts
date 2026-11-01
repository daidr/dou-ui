import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

const diag = (version: number | undefined, message: string) => ({
  method: 'textDocument/publishDiagnostics',
  params: {
    uri: 'file:///a',
    ...(version === undefined ? {} : { version }),
    diagnostics: [
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, message },
    ],
  },
})
const messages = (editor: CodeEditorExpose) => editor.diagnostics.map((d) => d.message)

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
      { label: 'alpha', kind: 'variable', detail: 'number' },
    ])
    const info = mount(defineComponent(() => completions!.options[1]!.info as () => any))
    expect(info.find('strong').text()).toBe('first')
    expect(info.text()).not.toContain('**')
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

  it('shows a second round of problems pushed for the same text', async () => {
    const server = fakeServer(full)
    const client = createLanguageClient({ transport: server.transport })
    const { editor } = setup([client.document({ uri: 'file:///a', languageId: 'x' })], 'let x')
    await flush()
    server.push(diag(1, 'syntax'))
    await flush()
    expect(messages(editor.value!)).toEqual(['syntax'])
    server.push(diag(1, 'semantic'))
    await flush()
    expect(messages(editor.value!)).toEqual(['semantic'])
  })

  it('takes the newest unversioned push as the problems of the text now', async () => {
    const server = fakeServer(full)
    const client = createLanguageClient({ transport: server.transport })
    const { editor } = setup([client.document({ uri: 'file:///a', languageId: 'x' })], 'abc')
    await flush()
    server.push(diag(undefined, 'v1'))
    await flush()
    editor.value!.transact((tr) => tr.replace(0, 0, 'Z'))
    await new Promise((resolve) => setTimeout(resolve, 400))
    server.push(diag(undefined, 'stale'))
    await flush()
    server.push(diag(undefined, 'fresh'))
    await flush()
    expect(messages(editor.value!)).toEqual(['fresh'])
  })

  it('ends a closed connection for good and opens documents again on the next one', async () => {
    const servers: Array<ReturnType<typeof fakeServer>> = []
    const client = createLanguageClient({
      transport: () => {
        const server = fakeServer(full)
        servers.push(server)
        return server.transport
      },
    })
    const a = setup([client.document({ uri: 'file:///a', languageId: 'x' })], 'abc')
    await flush()
    client.close()
    await flush()
    expect(servers[0]!.isClosed()).toBe(true)
    // Detached: no more messages for the closed connection.
    a.editor.value!.transact((tr) => tr.replace(0, 0, 'Z'))
    expect(servers[0]!.methods()).not.toContain('textDocument/didChange')
    a.wrapper.unmount()
    const b = setup([client.document({ uri: 'file:///b', languageId: 'x' })], 'abc')
    await flush()
    expect(servers[1]!.methods()).toContain('textDocument/didOpen')
    b.wrapper.unmount()
    await flush()
    expect(servers[1]!.methods().slice(-2)).toEqual(['shutdown', 'exit'])
    expect(servers[1]!.isClosed()).toBe(true)
  })

  it('ends waiting requests when the connection breaks', async () => {
    const server = fakeServer(full)
    let broken: (() => void) | undefined
    server.transport.onClose = (listener) => {
      broken = listener
      return () => (broken = undefined)
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = createLanguageClient({ transport: () => server.transport })
    const doc = client.document({ uri: 'file:///a', languageId: 'x' })
    const { editor } = setup([doc], 'abc')
    await flush()
    const send = server.transport.send
    server.transport.send = (message) => {
      if (message.method === 'textDocument/hover') server.received.push(message)
      else send(message)
    }
    const found = doc.hover!({ pos: 1, signal: new AbortController().signal }, editor.value as any)
    await flush()
    broken!()
    expect(await found).toBeNull()
    expect(server.isClosed()).toBe(true)
    expect(warn.mock.calls[0]![0]).toContain('[@dou-ui/code]')
    warn.mockRestore()
  })

  it('opens documents only when the server asks for it, and sends nothing then', async () => {
    const server = fakeServer({ textDocumentSync: { change: 2 }, hoverProvider: true })
    const client = createLanguageClient({ transport: server.transport })
    const doc = client.document({ uri: 'file:///a', languageId: 'x' })
    const { editor } = setup([doc], 'abc')
    await flush()
    expect(server.methods()).not.toContain('textDocument/didOpen')
    expect(
      await doc.hover!({ pos: 1, signal: new AbortController().signal }, editor.value as any),
    ).toBeNull()
    expect(server.methods()).not.toContain('textDocument/hover')

    const other = fakeServer({ textDocumentSync: { openClose: true, change: 0 } })
    const second = createLanguageClient({ transport: other.transport })
    const { editor: e2 } = setup([second.document({ uri: 'file:///b', languageId: 'x' })], 'abc')
    await flush()
    expect(other.methods()).toContain('textDocument/didOpen')
    e2.value!.transact((tr) => tr.replace(0, 0, 'Z'))
    expect(other.methods()).not.toContain('textDocument/didChange')
  })

  it('turns choices and variables in snippets into fields and defaults', async () => {
    const server = fakeServer(full, {
      'textDocument/completion': () => [
        {
          label: 'log',
          insertTextFormat: 2,
          insertText: 'log(${1|info,warn|}, $TM_FILENAME${TM_SELECTED_TEXT:text}$0)',
          documentation: 'Plain: `x` stays **as is**',
        },
      ],
    })
    const client = createLanguageClient({ transport: server.transport })
    const doc = client.document({ uri: 'file:///a', languageId: 'x' })
    const { editor } = setup([doc], '')
    await flush()
    const found = await doc.completion!(
      {
        pos: 0,
        word: { from: 0, to: 0, text: '' },
        explicit: true,
        signal: new AbortController().signal,
      },
      editor.value as any,
    )
    expect(found!.options[0]!.snippet).toBe('log(${1:info}, text$0)')
    // A plain string is plain text, marks and all.
    expect(found!.options[0]!.info).toBe('Plain: `x` stays **as is**')
  })

  it('goes to a definition from a command and from the touch toolbar', async () => {
    const server = fakeServer(full, {
      'textDocument/definition': () => ({
        uri: 'file:///a',
        range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } },
      }),
    })
    const client = createLanguageClient({ transport: server.transport })
    const doc = client.document({ uri: 'file:///a', languageId: 'x' })
    const { editor } = setup([doc], 'const x = 1\nx')
    await flush()
    editor.value!.select(12)
    expect(editor.value!.run(doc.goToDefinition)).toBe(true)
    await flush()
    expect(editor.value!.selection.ranges[0]!.head).toBe(6)
    // On a name the toolbar offers it; on a space it doesn't.
    const items = doc.menu!(editor.value as any)
    expect(items.map((item) => item.label)).toEqual(['跳到定义'])
    editor.value!.select(9)
    expect(doc.menu!(editor.value as any)).toEqual([])
  })

  it('sends the workspace folder and stays quiet when unmounted before the server answers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const server = fakeServer(full)
    const send = server.transport.send
    // The server never answers `initialize`.
    server.transport.send = (message) => {
      if (message.method === 'initialize') server.received.push(message)
      else send(message)
    }
    const client = createLanguageClient({
      transport: () => server.transport,
      rootUri: 'file:///work/shop',
    })
    const { wrapper } = setup([client.document({ uri: 'file:///a', languageId: 'x' })], '')
    await flush()
    expect((server.last('initialize')!.params as any).workspaceFolders).toEqual([
      { uri: 'file:///work/shop', name: 'shop' },
    ])
    wrapper.unmount()
    await flush()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

const render = (content: string | (() => any)) =>
  mount(defineComponent(() => (typeof content === 'string' ? () => content : content)))

describe('documentation', () => {
  it('draws Markdown, links only to web addresses, and nothing as HTML', async () => {
    const server = fakeServer(
      { textDocumentSync: 1, hoverProvider: true },
      {
        'textDocument/hover': () => ({
          contents: {
            kind: 'markdown',
            value: [
              '# Title',
              'An _important_ *note* with \\*stars\\* and <b>tags</b>.',
              '',
              '- one',
              '- [docs](https://example.com) and [bad](javascript:alert(1))',
              '',
              '---',
              '1. first',
              '2. second',
            ].join('\n'),
          },
        }),
      },
    )
    const client = createLanguageClient({ transport: server.transport })
    const doc = client.document({ uri: 'file:///a', languageId: 'x' })
    const { editor } = setup([doc], 'abc')
    await flush()
    const hover = await doc.hover!(
      { pos: 1, signal: new AbortController().signal },
      editor.value as any,
    )
    const view = render(hover!.content)
    expect(view.find('strong').text()).toBe('Title')
    expect(view.findAll('em').map((em) => em.text())).toEqual(['important', 'note'])
    expect(view.text()).toContain('*stars*')
    expect(view.find('b').exists()).toBe(false)
    expect(view.text()).toContain('<b>tags</b>')
    expect(view.findAll('ul li').map((li) => li.text())).toEqual(['one', 'docs and bad'])
    expect(view.findAll('a').map((a) => a.attributes('href'))).toEqual(['https://example.com'])
    expect(view.find('hr').exists()).toBe(true)
    expect(view.findAll('ol li').map((li) => li.text())).toEqual(['first', 'second'])
  })
})

describe('editor', () => {
  it('doesn’t run the linters again when given the same extensions in a new array', async () => {
    let runs = 0
    const linter = { name: 'count', lint: () => (runs++, []) }
    const list = ref([linter])
    mount(
      defineComponent(() => () => h(DouCodeEditor, { modelValue: 'a', extensions: list.value })),
      { attachTo: document.body },
    )
    await flush()
    const before = runs
    list.value = [linter]
    await flush()
    expect(runs).toBe(before)
  })
})
