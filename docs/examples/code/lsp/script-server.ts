// 在 worker 里运行的一个小型语言服务，说的是标准的语言服务器协议（LSP）：
// 收发 JSON-RPC 消息，按改动维护一份文本副本，回答补全、悬停、参数提示和跳转到定义，
// 每次改动后推送问题。换成真正的语言服务，页面这边的代码不用改。

interface Position {
  line: number
  character: number
}
interface Range {
  start: Position
  end: Position
}
interface Message {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: any
}

const uriOf = (params: any): string => params.textDocument.uri

/** 内置的函数和对象，带上说明 */
const api: Record<string, { params: string[]; returns: string; doc: string }> = {
  loadOrders: { params: ['city: string'], returns: 'Order[]', doc: '读取某个城市的订单。' },
  sumBy: { params: ['list: Order[]', 'key: string'], returns: 'number', doc: '按字段求和。' },
  groupBy: {
    params: ['list: Order[]', 'key: string'],
    returns: 'Record<string, Order[]>',
    doc: '按字段分组。',
  },
  formatMoney: {
    params: ['value: number'],
    returns: 'string',
    doc: '写成金额，比如 `¥1,280.00`。',
  },
  notify: { params: ['to: string', 'text: string'], returns: 'void', doc: '给某人发一条消息。' },
}
const members: Record<string, { detail: string; doc: string; params?: string[] }> = {
  title: { detail: 'string', doc: '月报的标题。' },
  addRow: {
    detail: '(cells: string[]) => void',
    doc: '在表格末尾加一行。',
    params: ['cells: string[]'],
  },
  send: { detail: '(to: string) => void', doc: '把月报发给某人。', params: ['to: string'] },
}
const keywords = ['const', 'let', 'function', 'return', 'if', 'else', 'for', 'of']

// ---- 文本副本 ----

const documents = new Map<string, { text: string; version: number }>()

function offsetAt(text: string, position: Position) {
  let at = 0
  for (let line = 0; line < position.line; line++) {
    const next = text.indexOf('\n', at)
    if (next < 0) return text.length
    at = next + 1
  }
  const end = text.indexOf('\n', at)
  return Math.min(at + position.character, end < 0 ? text.length : end)
}

function positionAt(text: string, offset: number): Position {
  const before = text.slice(0, offset)
  const line = before.split('\n').length - 1
  return { line, character: offset - before.lastIndexOf('\n') - 1 }
}

const rangeOf = (text: string, from: number, to: number): Range => ({
  start: positionAt(text, from),
  end: positionAt(text, to),
})

// ---- 分析 ----

/** 文本里声明的名字：函数（带参数）和变量 */
function declarations(text: string) {
  const out = new Map<string, { at: number; params?: string[] }>()
  for (const match of text.matchAll(/\bfunction\s+([\w$]+)\s*\(([^)]*)\)/g)) {
    const params = match[2]!
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    out.set(match[1]!, { at: match.index! + match[0].indexOf(match[1]!, 8), params })
  }
  for (const match of text.matchAll(/\b(?:const|let)\s+([\w$]+)/g))
    if (!out.has(match[1]!))
      out.set(match[1]!, { at: match.index! + match[0].lastIndexOf(match[1]!) })
  return out
}

function wordAt(text: string, offset: number) {
  let from = offset
  let to = offset
  while (from > 0 && /[\w$]/.test(text[from - 1]!)) from--
  while (to < text.length && /[\w$]/.test(text[to]!)) to++
  return { from, to, word: text.slice(from, to) }
}

function signatureOf(name: string, text: string) {
  if (api[name])
    return {
      params: api[name].params,
      label: `${name}(${api[name].params.join(', ')}): ${api[name].returns}`,
      doc: api[name].doc,
    }
  const member = name.startsWith('report.') ? members[name.slice(7)] : undefined
  if (member?.params)
    return { params: member.params, label: `${name}(${member.params.join(', ')})`, doc: member.doc }
  const declared = declarations(text).get(name)
  if (declared?.params)
    return {
      params: declared.params,
      label: `${name}(${declared.params.join(', ')})`,
      doc: '在这个文件里定义的函数。',
    }
  return null
}

function complete(text: string, offset: number) {
  const { from, word } = wordAt(text, offset)
  if (text[from - 1] === '.') {
    if (text.slice(0, from - 1).endsWith('report'))
      return Object.entries(members).map(([label, member]) => ({
        label,
        kind: member.params ? 2 : 10,
        detail: member.detail,
        documentation: member.doc,
        ...(member.params ? { insertText: `${label}($1)`, insertTextFormat: 2 } : {}),
      }))
    return []
  }
  const items: any[] = [
    ...Object.entries(api).map(([label, fn]) => ({
      label,
      kind: 3,
      detail: `(${fn.params.join(', ')}): ${fn.returns}`,
      documentation: { kind: 'markdown', value: fn.doc },
      insertText: `${label}($1)`,
      insertTextFormat: 2,
    })),
    { label: 'report', kind: 6, detail: 'Report', documentation: '这份月报。' },
    ...keywords.map((label) => ({ label, kind: 14 })),
  ]
  for (const [label, declared] of declarations(text))
    if (label !== word)
      items.push(
        declared.params
          ? {
              label,
              kind: 3,
              detail: `(${declared.params.join(', ')})`,
              insertText: `${label}($1)`,
              insertTextFormat: 2,
            }
          : { label, kind: 6 },
      )
  return items
}

function hover(text: string, offset: number) {
  const { from, to, word } = wordAt(text, offset)
  if (!word) return null
  const range = rangeOf(text, from, to)
  const name =
    text[from - 1] === '.' && text.slice(0, from - 1).endsWith('report') ? `report.${word}` : word
  if (name.startsWith('report.') && members[word]) {
    const member = members[word]
    return {
      range,
      contents: {
        kind: 'markdown',
        value: `\`\`\`ts\n(report) ${word}: ${member.detail}\n\`\`\`\n${member.doc}`,
      },
    }
  }
  const signature = signatureOf(name, text)
  if (signature)
    return {
      range,
      contents: {
        kind: 'markdown',
        value: `\`\`\`ts\nfunction ${signature.label}\n\`\`\`\n${signature.doc}`,
      },
    }
  if (declarations(text).has(word))
    return { range, contents: { kind: 'markdown', value: `\`\`\`ts\nconst ${word}\n\`\`\`` } }
  return null
}

/** 光标所在的调用：函数名和正在填写第几个参数 */
function signatureHelp(text: string, offset: number) {
  let depth = 0
  let commas = 0
  for (let at = offset - 1; at >= 0; at--) {
    const ch = text[at]
    if (ch === ')' || ch === ']') depth++
    else if (ch === '(' || ch === '[') {
      if (depth > 0) {
        depth--
        continue
      }
      if (ch === '[') return null
      const name = /([\w$]+(?:\.[\w$]+)?)\s*$/.exec(text.slice(0, at))?.[1]
      const signature = name && signatureOf(name, text)
      if (!signature) return null
      return {
        signatures: [
          {
            label: signature.label,
            documentation: { kind: 'markdown', value: signature.doc },
            parameters: signature.params.map((label) => ({ label })),
          },
        ],
        activeSignature: 0,
        activeParameter: Math.min(commas, signature.params.length - 1),
      }
    } else if (ch === ',' && depth === 0) commas++
    else if (ch === ';' || (ch === '\n' && depth === 0 && text[at - 1] === '}')) return null
  }
  return null
}

function definition(uri: string, text: string, offset: number) {
  const { word, from } = wordAt(text, offset)
  if (text[from - 1] === '.') return null
  const declared = declarations(text).get(word)
  if (!declared) return null
  return { uri, range: rangeOf(text, declared.at, declared.at + word.length) }
}

function diagnostics(text: string) {
  const out: any[] = []
  const declared = declarations(text)
  const body = text.replace(/\/\/.*$/gm, (comment) => ' '.repeat(comment.length))
  for (const match of body.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = match[1]!
    if (api[name] || declared.has(name) || keywords.includes(name)) continue
    out.push({
      range: rangeOf(text, match.index!, match.index! + name.length),
      severity: 1,
      source: 'script',
      message: `找不到函数 ${name}`,
    })
  }
  for (const [name, { at, params }] of declared) {
    if (params) continue
    const uses = [
      ...body.matchAll(new RegExp(`(?<![\\w$.])${name.replace('$', '\\$')}(?![\\w$])`, 'g')),
    ]
    if (uses.length === 1)
      out.push({
        range: rangeOf(text, at, at + name.length),
        severity: 4,
        source: 'script',
        message: `${name} 声明了但没有用到`,
      })
  }
  return out
}

// ---- 协议 ----

const reply = (message: Message) =>
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no target origin
  self.postMessage({ jsonrpc: '2.0', ...message })

function publish(uri: string) {
  const document = documents.get(uri)
  if (!document) return
  reply({
    method: 'textDocument/publishDiagnostics',
    params: { uri, version: document.version, diagnostics: diagnostics(document.text) },
  })
}

const handlers: Record<string, (params: any) => unknown> = {
  initialize: () => ({
    capabilities: {
      textDocumentSync: { openClose: true, change: 2 },
      completionProvider: { triggerCharacters: ['.'] },
      hoverProvider: true,
      signatureHelpProvider: { triggerCharacters: ['(', ','] },
      definitionProvider: true,
    },
    serverInfo: { name: 'script-server' },
  }),
  shutdown: () => null,
  'textDocument/completion': (params) => {
    const document = documents.get(uriOf(params))!
    return complete(document.text, offsetAt(document.text, params.position))
  },
  'textDocument/hover': (params) => {
    const document = documents.get(uriOf(params))!
    return hover(document.text, offsetAt(document.text, params.position))
  },
  'textDocument/signatureHelp': (params) => {
    const document = documents.get(uriOf(params))!
    return signatureHelp(document.text, offsetAt(document.text, params.position))
  },
  'textDocument/definition': (params) => {
    const document = documents.get(uriOf(params))!
    return definition(uriOf(params), document.text, offsetAt(document.text, params.position))
  },
}

const notifications: Record<string, (params: any) => void> = {
  'textDocument/didOpen': ({ textDocument }) => {
    documents.set(textDocument.uri, { text: textDocument.text, version: textDocument.version })
    publish(textDocument.uri)
  },
  'textDocument/didChange': ({ textDocument, contentChanges }) => {
    const document = documents.get(textDocument.uri)!
    // 按顺序应用每处改动；没有 range 的是整段文本
    for (const change of contentChanges) {
      if (!change.range) document.text = change.text
      else {
        const from = offsetAt(document.text, change.range.start)
        const to = offsetAt(document.text, change.range.end)
        document.text = document.text.slice(0, from) + change.text + document.text.slice(to)
      }
    }
    document.version = textDocument.version
    publish(textDocument.uri)
  },
  'textDocument/didClose': ({ textDocument }) => documents.delete(textDocument.uri),
  exit: () => self.close(),
}

self.addEventListener('message', ({ data }: MessageEvent<Message>) => {
  if (data.id === undefined) return notifications[data.method!]?.(data.params)
  const handler = handlers[data.method!]
  if (!handler)
    return reply({ id: data.id, error: { code: -32601, message: `不支持 ${data.method}` } } as any)
  reply({ id: data.id, result: handler(data.params) ?? null } as any)
})
