# Markdown 流式渲染

渲染 Markdown 文本。流式输出时，写了一半的语法以最终的样子显示，新内容逐步淡入。

## 基础用法

把 Markdown 文本传给 `content`。支持标题、段落、列表、任务列表、引用、代码块、表格、分割线、链接、图片，以及加粗、斜体、删除线和行内代码。

<DocDemo src="markdown/basic" column />

## 流式输出

和 [StreamText](./stream-text) 一样，把目前收到的全部文本传给 `content`，还有内容要来时把 `streaming` 设为 `true`。输出过程中末尾有一个闪烁的光标，`caret` 设为 `false` 可以去掉。

<DocDemo src="markdown/stream" column />

新内容每秒至少显示 `speed` 个字，积压多时自动加快；`smooth` 设为 `false` 时收到多少显示多少。挂载时已经有的内容（比如历史消息）直接显示。新出现的文字、表格行和代码行用 320ms 淡入，系统开启“减弱动态效果”时不做动画，也不逐步显示。

写了一半的语法直接按最终的样子显示，不会先闪出符号再变样：

- `**加粗` 还没闭合时已经是粗体；`[文字](https://…` 先显示成链接样式，地址完整后才能点击。
- 表格的表头行先不显示，分隔行一出现就显示带表头的表格，之后逐行增加。
- 代码块没闭合时照常显示，每写完一行才高亮这一行。
- 行首只有 `-`、`1.`、`#`、`>`、`:::` 这类标记时先不显示，内容出现后再按最终的类型显示。

`streaming` 变为 `false` 并且内容全部显示完后触发 `done`。

## 在对话中使用

[ChatMessage](./chat-message) 设置 `markdown` 后，文字和思考过程片段用 Markdown 渲染。想让所有消息都使用 Markdown，在 `defaults` 里设置一次：

```ts
app.use(DouUI, {
  defaults: {
    DouChatMessage: { markdown: true },
  },
})
```

`markdown` 也可以是一个对象，同时传入 `sanitizeUrl`、`linkTarget`、`speed` 等选项。下面的插槽在 ChatMessage 上加 `markdown-` 前缀使用，比如 `#markdown-code`、`#markdown-container-tip`。

代码块使用 [CodeBlock](./code-block) 显示，高亮沿用它的全局设置。下面的例子用 `@dou-ui/code` 的 `createCodeHighlighter`，代码块和[代码编辑器](/code/)的颜色一致。

<DocDemo src="markdown/chat" column />

## 角标

传入 `sources` 后，正文中的 `[1]`、`[^1]`、`[1, 2]` 显示为可预览的[角标](./chat-sources#角标引用)，编号从 1 开始对应 `sources` 中的来源。ChatMessage 会自动把消息里 `sources` 片段的来源按顺序传进来。

- 编号没有对应来源时按原文显示。来源比正文晚到时，`[1]` 先显示为原文，来源到达后再变成角标，所以最好先给出来源。
- 链接文字里的 `[1]` 和 `a[1].b` 这类代码写法不会变成角标。
- `citation` 插槽可以换成自己的角标，参数为 `{ index, source }`。

## 自定义块

`:::名字` 开始一个自定义块，`:::` 结束，名字后面的文字是标题，块里可以写任意 Markdown。`tip`、`info`、`note`、`warning`、`danger` 默认显示为对应语气的 [Alert](./alert)；其他名字交给 `container-名字` 插槽，没有插槽时显示标题和内容，不加样式。

<DocDemo src="markdown/container" column />

插槽参数为 `{ name, title, streaming, children, node }`。`container` 插槽接管所有没有专门插槽的自定义块。块里要再放一个块时，外层多写一个冒号：

```md
::::steps
:::tip
内层
:::
::::
```

## 替换渲染

每种元素都有一个同名插槽，可以换成自己的组件：

| 插槽                                       | 参数                                         |
| ------------------------------------------ | -------------------------------------------- |
| `paragraph`、`blockquote`、`list`、`table` | `{ node, children }`                         |
| `heading`                                  | `{ node, level, children }`                  |
| `item`                                     | `{ node, checked, children }`                |
| `hr`                                       | `{ node }`                                   |
| `code`、`code-语言`                        | `{ node, code, lang, streaming }`            |
| `container`、`container-名字`              | `{ node, name, title, streaming, children }` |
| `link`                                     | `{ node, href, title, external, children }`  |
| `image`                                    | `{ src, alt, title }`                        |
| `citation`                                 | `{ index, source }`                          |
| `inline-code`                              | `{ code }`                                   |
| `strong`、`em`、`del`                      | `{ children }`                               |

`children` 是元素里原本要显示的内容，流式时的渐显和光标都在里面，用 `<component :is="children" />` 放到自己的组件里。`code-语言`、`container-名字` 优先于 `code`、`container`。

<DocDemo src="markdown/slots" column />

- `link` 的 `href` 已经过 `sanitizeUrl` 检查，地址还没写完或被丢弃时为 `undefined`；`external` 表示完整地址（`https://…`、`//…`），可以据此把站内地址交给路由。
- `code` 的 `streaming` 表示这个代码块还没有闭合，而不是整个回答还在输出。改用自己的 CodeBlock 时把它传给 `streaming`，就能保持“只高亮完整的行”。
- `link`、`image`、`citation`、`inline-code`、`strong`、`em`、`del` 在段落里面，插槽里要用 `span` 这类行内元素，放 `div` 会让服务端渲染的 HTML 被浏览器拆开。
- 想换掉高亮器而不换组件时，不需要插槽，在 `defaults` 里设置 CodeBlock 的 `highlight` 即可。

## 跟在正文末尾

`trailing` 插槽的内容跟在正文最后一个字后面，和文字在同一行，适合放“已编辑”这类标记。它的位置和流式输出的光标一样：最后一段、标题、列表项或表格最后一格的末尾，最后一块是引用或 `:::` 自定义块时就在框里面，生成中时在光标后面。最后一块是代码块或分隔线时，后面接不了文字，它单独占一行。插槽里要用 `span`、`button` 这类行内元素。在 ChatMessage 里用它的 [`trailing`](./chat-message#跟在文字后面的标记) 插槽，不用加 `markdown-` 前缀。

## 安全

- 不解析 HTML：`<script>`、`<img onerror>` 这类内容按原样显示为文字。
- 链接、图片和角标来源的地址默认只允许 `http:`、`https:`、`mailto:`、`tel:`、相对地址和锚点，`javascript:`、`data:` 等会被去掉（链接保留文字，来源保留标题）。规则就是导出的 `defaultSanitizeUrl`。
- 只有完整地址在新窗口打开，并带 `rel="noopener noreferrer"`；相对地址和锚点在当前页打开。`linkTarget` 设为 `'_self'` 时全部在当前页打开。

需要放宽或收紧时传入 `sanitizeUrl`，返回 `undefined` 表示丢弃。角标来源的地址只能收紧：角标本身还会按默认规则再检查一次，放行的其他协议在角标里仍然不能点击。在默认规则上多允许一种地址：

```ts
import { defaultSanitizeUrl } from 'dou-ui'

const sanitizeUrl = (url: string, kind: 'link' | 'image' | 'source') =>
  url.startsWith('myapp:') ? url : defaultSanitizeUrl(url, kind)
```

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
parser.update(text, { final: true })
```

## API

### Props

| 名称          | 说明                                                | 类型                                                                        | 默认值         |
| ------------- | --------------------------------------------------- | --------------------------------------------------------------------------- | -------------- |
| `content`     | Markdown 文本，流式时为目前收到的全部内容           | `string`                                                                    | `''`           |
| `streaming`   | 是否还有内容要来                                    | `boolean`                                                                   | `false`        |
| `smooth`      | 逐步显示并渐显新内容                                | `boolean`                                                                   | `true`         |
| `speed`       | 每秒最少显示的字数                                  | `number`                                                                    | `40`           |
| `caret`       | 输出过程中在末尾显示光标                            | `boolean`                                                                   | `true`         |
| `sources`     | 引用来源，正文中的 `[1]` 显示为角标                 | `ChatSource[]`                                                              | —              |
| `linkTarget`  | 完整地址的链接在哪里打开                            | `'_blank' \| '_self' \| '_parent' \| '_top' \| string`                      | `'_blank'`     |
| `sanitizeUrl` | 检查链接、图片和来源的地址，返回 `undefined` 时丢弃 | `(url: string, kind: 'link' \| 'image' \| 'source') => string \| undefined` | 只允许安全协议 |

### Events

| 名称   | 说明                                        | 参数 |
| ------ | ------------------------------------------- | ---- |
| `done` | 内容全部显示完，并且 `streaming` 为 `false` | —    |

### Slots

见[替换渲染](#替换渲染)和[跟在正文末尾](#跟在正文末尾)。

### Exposes

| 名称    | 说明                     | 类型         |
| ------- | ------------------------ | ------------ |
| `flush` | 立即显示已收到的全部内容 | `() => void` |

### 类型

| 名称                 | 说明                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MarkdownBlock`      | 块的联合类型，按 `type` 区分：`MarkdownParagraph`、`MarkdownHeading`、`MarkdownCode`、`MarkdownHr`、`MarkdownBlockquote`、`MarkdownContainer`、`MarkdownList`、`MarkdownTable` |
| `MarkdownItem`       | 列表项，`type: 'item'`                                                                                                                                                         |
| `MarkdownRow`        | 表格行，`type: 'row'`                                                                                                                                                          |
| `MarkdownInline`     | 行内内容：文字、粗体、斜体、删除线、行内代码、链接、图片、换行                                                                                                                 |
| `MarkdownParser`     | `createMarkdownParser()` 的返回值，`update(source, { final })`、`stable`、`reset()`                                                                                            |
| `MarkdownUrlKind`    | `'link' \| 'image' \| 'source'`                                                                                                                                                |
| `defaultSanitizeUrl` | 默认的地址检查，参数和 `sanitizeUrl` 相同                                                                                                                                      |
