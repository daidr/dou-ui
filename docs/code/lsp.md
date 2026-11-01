# 语言服务

`@dou-ui/code/lsp` 用于接入遵循语言服务器协议（LSP）的语言服务，为编辑器提供补全、悬停说明、参数提示、问题检查和跳到定义。

## 基础用法

`createLanguageClient` 连接一个语言服务，`client.document()` 为一个文件生成扩展，传给编辑器的 `extensions`。

<DocDemo src="code/lsp" column />

示例在 worker 中运行了一个小型语言服务。输入时会弹出补全，悬停在函数名上会显示说明，`sendMail` 会被标为问题。把光标放在 `line` 上按 `F12` 可以跳到它的定义。

```ts
import { createLanguageClient, workerTransport } from '@dou-ui/code/lsp'

const client = createLanguageClient({
  transport: () =>
    workerTransport(new Worker(new URL('./server.ts', import.meta.url), { type: 'module' })),
})
const server = client.document({ uri: 'file:///report.js', languageId: 'javascript' })
```

一个 `client` 可以给多个文件使用，每个编辑器使用各自的 `client.document()`。编辑器挂载后向语言服务打开这个文件，之后只发送改动的部分。实际能用哪些功能，取决于语言服务在初始化时声明支持的能力。

## 跳到定义

按 `F12` 跳到光标处名字的定义。触屏上点一下名字放置光标，再点一下光标，在工具条中选择“跳到定义”。

`server.goToDefinition` 是同一个命令，可以传给 `editor.run()`、放进 `DouCodeKeys` 的按键或自己的按钮。定义在其他文件中时，会调用 `client.document()` 的 `openLocation(location)`，由你打开对应的文件。

## 连接方式

### Web Worker

`workerTransport(worker)` 连接在 Web Worker 中运行的语言服务，不会阻塞页面，也不需要服务器。

### WebSocket

`socketTransport(socket)` 连接服务器上的语言服务，每帧一条 JSON 消息：

```ts
import { createLanguageClient, socketTransport } from '@dou-ui/code/lsp'

const client = createLanguageClient({
  transport: () => socketTransport(new WebSocket('wss://example.com/lsp')),
  rootUri: 'file:///workspace',
})
```

### 连接的生命周期

- `transport` 是函数时，第一个使用它的编辑器挂载时才创建连接，最后一个卸载后关闭；之后再挂载会重新连接。服务端渲染时不会创建连接。
- `transport` 直接传入连接对象时，连接一直保持，直到调用 `client.close()`。连接断开后无法再使用，需要自动重连时请传入函数。
- 连接断开时，等待中的请求都会结束，开发环境下会在控制台警告一次。

其他连接方式只需要实现 `LspTransport`：`{ send, onMessage, close?, onClose? }`。

## 在服务器上转接

多数语言服务通过标准输入输出通信，每条消息前带 `Content-Length` 头。在浏览器中使用时，需要在服务器上把 WebSocket 消息转接给语言服务进程。下面是用 Node.js 和 `ws` 写的最小示例：

```ts
import { spawn } from 'node:child_process'
import { WebSocketServer } from 'ws'

new WebSocketServer({ port: 3001 }).on('connection', (socket) => {
  // 每个连接启动一个语言服务进程
  const server = spawn('typescript-language-server', ['--stdio'])
  let buffer = Buffer.alloc(0)
  server.stdout.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])
    for (;;) {
      const end = buffer.indexOf('\r\n\r\n')
      if (end < 0) break
      const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, end).toString())?.[1])
      if (buffer.length < end + 4 + length) break
      socket.send(buffer.subarray(end + 4, end + 4 + length).toString())
      buffer = buffer.subarray(end + 4 + length)
    }
  })
  socket.on('message', (data) => {
    const body = Buffer.from(data.toString())
    server.stdin.write(`Content-Length: ${body.length}\r\n\r\n`)
    server.stdin.write(body)
  })
  socket.on('close', () => server.kill())
  server.on('exit', () => socket.close())
})
```

::: warning 注意
语言服务能读写所在机器上的文件，有的还会执行项目中的代码。对外开放转接时，请先验证用户身份，并把语言服务限制在单独的目录或容器中。
:::

## 支持范围

支持补全、悬停说明、参数提示、问题（推送和按需拉取）以及跳到定义。说明中的 Markdown 会排版显示，链接只接受 `http` 和 `https` 地址。

暂不支持补全项的附加修改（例如自动加上 `import`）、按需获取补全项说明、代码操作、重命名和格式化。需要时可以用 `client.request()` 自己发送请求。

## API

### createLanguageClient(options)

| 选项                    | 说明                                        | 类型                                   |
| ----------------------- | ------------------------------------------- | -------------------------------------- |
| `transport`             | 连接，或创建连接的函数                      | `LspTransport \| (() => LspTransport)` |
| `rootUri`               | 工作区文件夹的 URI                          | `string \| null`                       |
| `initializationOptions` | 作为 `initializationOptions` 发送给语言服务 | `unknown`                              |

### LanguageClient

| 名称                                | 说明                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| `document(options)`                 | 为一个文件生成扩展，见下表                                 |
| `request(method, params?, signal?)` | 发送请求，返回 Promise；`signal` 中止时通知语言服务取消    |
| `notify(method, params?)`           | 发送通知                                                   |
| `onNotification(method, fn)`        | 监听语言服务的通知，例如 `window/logMessage`；返回取消函数 |
| `capabilities`                      | 语言服务声明的能力，初始化完成前为 `null`                  |
| `close()`                           | 关闭语言服务和连接                                         |

### client.document(options)

| 选项           | 说明                                      | 类型                              |
| -------------- | ----------------------------------------- | --------------------------------- |
| `uri`          | 文件的 URI，例如 `file:///src/report.ts`  | `string`                          |
| `languageId`   | 语言服务使用的语言标识，例如 `typescript` | `string`                          |
| `openLocation` | 定义在其他文件中时调用，由你打开该文件    | `(location: LspLocation) => void` |

返回的扩展上有 `goToDefinition` 命令。

### 其他导出

| 名称                             | 说明                                                  |
| -------------------------------- | ----------------------------------------------------- |
| `workerTransport(worker)`        | 通过 Web Worker 连接；worker 加载失败时视为断开       |
| `socketTransport(socket)`        | 通过 WebSocket 连接；打开之前发送的消息会等待连接打开 |
| `toLspPosition(doc, pos)`        | 把文本位置换算为 `LspPosition`                        |
| `fromLspPosition(doc, position)` | 把 `LspPosition` 换算为文本位置                       |

### 类型

| 类型           | 说明                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `LspTransport` | `{ send(message), onMessage(listener), close?(), onClose?(listener) }`，收发 JSON-RPC 消息对象 |
| `LspPosition`  | `{ line, character }`，从 0 开始，按 UTF-16 计数                                               |
| `LspRange`     | `{ start: LspPosition, end: LspPosition }`                                                     |
| `LspLocation`  | `{ uri, range: LspRange }`                                                                     |
