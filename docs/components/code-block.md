# CodeBlock 代码块

展示一段代码，带文件名、复制按钮、行号和行高亮。

## 基础用法

`code` 传入代码，`lang` 指定语言。有 `filename` 或 `lang` 时显示标题栏，复制按钮在标题栏右侧；没有标题栏时，复制按钮在鼠标移入时出现在右上角。`copyable` 设为 `false` 可以去掉复制按钮。

CodeBlock 本身不带语法高亮，通过 `highlight` 接入高亮工具。`highlight` 的写法与 [shiki](https://shiki.style) 的 `codeToHtml` 一致：接收代码和语言，返回 HTML，可以是 Promise。

<DocDemo src="code-block/basic" column />

```ts
import { codeToHtml } from 'shiki'

const highlight = (code: string, lang: string) =>
  codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })
```

- 使用 `themes` 同时指定亮色和暗色主题，并设置 `defaultColor: false`。shiki 会把两套颜色写成 `--shiki-light` 和 `--shiki-dark`，CodeBlock 按所在主题的亮暗选用，切换主题时不需要重新高亮。
- shiki 生成的背景色不会使用，代码块的背景由主题决定。
- 其他高亮工具也可以使用，只要返回的 HTML 每行是一个 `<span class="line">`，行与行之间用换行分隔，外面可以带 `<pre><code>`，也可以不带。
- `highlight` 返回 Promise 时，结果出来之前先显示没有高亮的代码。返回字符串时（例如 shiki 的 `createHighlighterCoreSync`），服务端渲染的结果就已经是高亮过的。

## 全局设置

在 `ConfigProvider` 或插件选项的 `defaults` 里设置一次 `highlight`，之后所有代码块都会使用它：

```ts
app.use(DouUI, {
  defaults: {
    DouCodeBlock: { highlight },
  },
})
```

## 行号与行高亮

`line-numbers` 显示行号，`start-line` 设置第一行的行号。`highlight-lines` 标出指定的行，写成数组 `[1, 3]` 或字符串 `'1,3-5'`，按显示的行号计算。

也可以使用 shiki 的注释标记：`transformerNotationHighlight` 生成的 `// [!code highlight]` 行同样会被标出，`transformerNotationDiff` 生成的 `// [!code ++]`、`// [!code --]` 行分别显示为新增和删除。

<DocDemo src="code-block/lines" column />

## 折叠与换行

`max-lines` 设置最多显示几行，超出时折叠，底部按钮可以展开。`wrap` 让长行自动换行，而不是横向滚动。

<DocDemo src="code-block/fold" column />

## 在对话中使用

[ChatMessage](./chat-message) 的 `part` 插槽可以用 CodeBlock 渲染代码片段。

<DocDemo src="code-block/chat" column />

## API

### Props

| 名称             | 说明                                             | 类型                                                        | 默认值          |
| ---------------- | ------------------------------------------------ | ----------------------------------------------------------- | --------------- |
| `code`           | 代码                                             | `string`                                                    | `''`            |
| `lang`           | 语言，传给 `highlight`，没有文件名时显示在标题栏 | `string`                                                    | `'text'`        |
| `filename`       | 标题栏中的文件名                                 | `string`                                                    | —               |
| `highlight`      | 高亮函数，写法同 shiki 的 `codeToHtml`           | `(code: string, lang: string) => string \| Promise<string>` | 全局 `defaults` |
| `lineNumbers`    | 显示行号                                         | `boolean`                                                   | `false`         |
| `startLine`      | 第一行的行号                                     | `number`                                                    | `1`             |
| `highlightLines` | 标出的行                                         | `number[] \| string`                                        | —               |
| `wrap`           | 长行自动换行                                     | `boolean`                                                   | `false`         |
| `maxLines`       | 超过这么多行时折叠                               | `number`                                                    | —               |
| `copyable`       | 显示复制按钮                                     | `boolean`                                                   | `true`          |

### Slots

| 名称      | 说明                           |
| --------- | ------------------------------ |
| `title`   | 替换标题栏中的文件名或语言     |
| `actions` | 标题栏右侧、复制按钮之前的内容 |

### CSS 变量

| 变量                           | 说明           |
| ------------------------------ | -------------- |
| `--dou-code-block-bg`          | 背景色         |
| `--dou-code-block-font-size`   | 字号           |
| `--dou-code-block-line-height` | 行高           |
| `--dou-code-block-padding-x`   | 左右内边距     |
| `--dou-code-block-padding-y`   | 上下内边距     |
| `--dou-code-block-mark`        | 标出的行的底色 |
