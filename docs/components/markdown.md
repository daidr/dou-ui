# Markdown 流式渲染

渲染 Markdown，也能在模型逐字输出时稳定、顺滑地显示：已经写完的部分不再重新解析和渲染，写了一半的语法直接以最终的样子出现，新内容逐步渐显。

## 基础用法

把 Markdown 文本传给 `content`。支持标题、段落、列表、任务列表、引用、代码块、表格、分割线、链接、图片，以及加粗、斜体、删除线和行内代码。

<DocDemo src="markdown/basic" column />

## 流式输出

和 [StreamText](./stream-text) 一样，把目前收到的全部文本传给 `content`，还有内容要来时 `streaming` 设为 `true`。`caret` 在末尾显示一个闪烁的光标。

<DocDemo src="markdown/stream" column />

输出过程中有几个细节：

- **按帧合并**：一帧之内不管收到多少次更新，只解析和渲染一次，更新再频繁开销也有上限。
- **逐步显示**：新内容每秒至少显示 `speed` 个字，积压多时自动加快，不会落后太多。`smooth` 设为 `false` 时收到多少显示多少。挂载时已经有的内容（比如历史消息）直接显示。
- **渐显**：新出现的文字、表格行、代码行用 320ms 淡入；系统开启“减弱动态效果”时不做动画，也不逐步显示。
- **写了一半的语法**：
  - `**加粗` 还没闭合时已经按加粗显示，`[文字](https://…` 先显示成链接样式，地址完整后才能点击。
  - 表格的表头行先不显示，分隔行一出现就显示带表头的表格，之后逐行增加。
  - 代码块没闭合时照常显示，最后一行写完才高亮。
  - 行首只有 `-`、`1.`、`#`、`>` 这类标记时先不显示，等内容出现后再按最终的类型显示，不会先闪出一个符号。
- **已写完的块不再渲染**：一个块确定不会再变后就固定下来，之后只处理末尾仍在增长的部分，长回答的末尾更新和开头一样快。

`streaming` 变为 `false` 并且内容全部显示完后触发 `done`。

## 在对话中使用

[ChatMessage](./chat-message) 设置 `markdown` 后，文字片段用 Markdown 渲染。消息里 `sources` 片段的来源会按顺序编号，正文中的 `[1]` 显示为可预览的[角标](./chat-sources#角标引用)。

想让所有消息都使用 Markdown，在 `defaults` 里设置一次：

```ts
app.use(DouUI, {
  defaults: {
    DouChatMessage: { markdown: true },
  },
})
```

代码块使用 [CodeBlock](./code-block) 显示，高亮沿用它的全局设置。下面的例子用 `@dou-ui/code` 的 `createCodeHighlighter`，代码块和[代码编辑器](/code/)的颜色一致。

<DocDemo src="markdown/chat" column />

单独使用时，`sources` 属性同样可以把 `[1]` 显示为角标。

## 自定义代码块和图片

`code` 插槽接管围栏代码块，参数为 `{ code, lang, streaming }`，可以按语言换成别的组件，比如把 `mermaid` 交给图表。`image` 插槽接管图片，参数为 `{ src, alt, title }`。

<DocDemo src="markdown/slots" column />

## 安全

- 不解析 HTML：`<script>`、`<img onerror>` 这类内容按原样显示为文字。
- 链接和图片地址默认只允许 `http:`、`https:`、`mailto:`、`tel:`、相对地址和锚点，`javascript:`、`data:` 等会被去掉（链接保留文字）。需要放宽或收紧时传入 `sanitizeUrl`，返回 `undefined` 表示丢弃。
- 新窗口打开的链接带 `rel="noopener noreferrer"`。`linkTarget` 设为 `'_self'` 可以在当前页打开。

## 服务端渲染

首次渲染时同步解析，服务端输出完整的 HTML，客户端接管时不会闪烁。

## 单独使用解析器

`parseMarkdown` 把整篇 Markdown 解析成块，`createMarkdownParser` 创建增量解析器，适合在服务端或 Worker 里使用：

```ts
import { createMarkdownParser } from 'dou-ui'

const parser = createMarkdownParser()
let text = ''
for await (const chunk of reply) {
  text += chunk
  // 没有变化的块是同一个对象
  const blocks = parser.update(text)
}
parser.update(text, true) // 结束时传 true
```

## API

### Props

| 名称          | 说明                                        | 类型                                                            | 默认值         |
| ------------- | ------------------------------------------- | --------------------------------------------------------------- | -------------- |
| `content`     | Markdown 文本，流式时为目前收到的全部内容   | `string`                                                        | `''`           |
| `streaming`   | 是否还有内容要来                            | `boolean`                                                       | `false`        |
| `smooth`      | 逐步显示并渐显新内容                        | `boolean`                                                       | `true`         |
| `speed`       | 每秒最少显示的字数                          | `number`                                                        | `60`           |
| `caret`       | 输出过程中在末尾显示光标                    | `boolean`                                                       | `false`        |
| `sources`     | 引用来源，正文中的 `[1]` 显示为角标         | `ChatSource[]`                                                  | —              |
| `linkTarget`  | 链接的打开方式                              | `string`                                                        | `'_blank'`     |
| `sanitizeUrl` | 检查链接和图片地址，返回 `undefined` 时丢弃 | `(url: string, kind: 'link' \| 'image') => string \| undefined` | 只允许安全协议 |

### Events

| 名称   | 说明                                        | 参数 |
| ------ | ------------------------------------------- | ---- |
| `done` | 内容全部显示完，并且 `streaming` 为 `false` | —    |

### Slots

| 名称    | 说明                                               |
| ------- | -------------------------------------------------- |
| `code`  | 渲染围栏代码块，参数为 `{ code, lang, streaming }` |
| `image` | 渲染图片，参数为 `{ src, alt, title }`             |

### Exposes

| 名称    | 说明                     | 类型         |
| ------- | ------------------------ | ------------ |
| `flush` | 立即显示已收到的全部内容 | `() => void` |
