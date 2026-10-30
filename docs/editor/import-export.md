# 导入与导出

文档可以写成 HTML 或 Markdown，也可以从这两种格式读入。每种块、行内节点和文字格式怎样写出、怎样读入，由提供它的扩展决定，自定义的块也可以用同样的方式接入。

## 导出

`blocksToHTML` 把块写成 HTML，`blocksToMarkdown` 把块写成 Markdown。两者都接收块和编辑器使用的扩展，不需要浏览器环境，可以在服务端运行。

```ts
import { blocksToHTML, starterKit } from '@dou-ui/editor'
import { blocksToMarkdown } from '@dou-ui/editor/markdown'

const extensions = [starterKit()]

const html = blocksToHTML(blocks, extensions)
const markdown = blocksToMarkdown(blocks, extensions)
```

<DocDemo src="editor/export" column />

HTML 只包含语义标签，不带编辑器的类名，可以直接用于邮件、页面或搜索索引。编辑器实例的 `getHTML()` 等同于用当前文档调用 `blocksToHTML`。

## 导入

`htmlToBlocks` 和 `markdownToBlocks` 把 HTML 或 Markdown 读成块，规则与粘贴相同：只保留扩展认识的内容，其余的（例如 `<script>`、不安全的链接、没有对应扩展的内容）会被丢弃。块的 `id` 自动生成。

```ts
import { htmlToBlocks } from '@dou-ui/editor'
import { markdownToBlocks } from '@dou-ui/editor/markdown'

const blocks = markdownToBlocks(text, extensions)
```

<DocDemo src="editor/import" column />

导入需要 `DOMParser`，在浏览器里运行；在服务端使用时需要先提供一个 DOM 实现。编辑器实例的 `setHTML(html)` 用 HTML 替换整个文档。

`markdownToBlocks` 使用 [markdown-it](https://github.com/markdown-it/markdown-it) 解析 Markdown，需要另外安装：

```sh
bun add markdown-it
```

也可以通过 `render` 选项换成自己的解析方式，它接收 Markdown，返回 HTML：

```ts
markdownToBlocks(text, extensions, { render: (markdown) => myParser.render(markdown) })
```

## 内置内容的写法

| 内容     | HTML                                              | Markdown                                |
| -------- | ------------------------------------------------- | --------------------------------------- |
| 段落     | `<p>`                                             | 正文                                    |
| 标题     | `<h1>` – `<h3>`                                   | `#` – `###`                             |
| 列表     | `<ul>`、`<ol>`，子块嵌套在 `<li>` 里              | `-`、`1.`，子块缩进                     |
| 待办     | `<ul class="task-list">` 与禁用的复选框           | `- [ ]`、`- [x]`                        |
| 引用     | `<blockquote>`                                    | `>`                                     |
| 提示块   | `<aside data-callout="tip">`                      | `> [!TIP]` 等 GitHub 提示语法           |
| 折叠块   | `<details>` 与 `<summary>`                        | 同 HTML                                 |
| 代码块   | `<pre><code class="language-ts">`                 | 代码围栏                                |
| 分隔线   | `<hr>`                                            | `---`                                   |
| 图片     | `<figure>`、`<img>` 与 `<figcaption>`             | `![替代文字](地址 "说明文字")`          |
| 提及     | `<span data-mention="id">`                        | 同 HTML                                 |
| 表格     | `<table>`，表头用 `<thead>` 与 `<th>`             | GitHub 表格                             |
| 文字格式 | `<strong>`、`<em>`、`<u>`、`<s>`、`<code>`、`<a>` | `**`、`*`、`<u>`、`~~`、`` ` ``、`[]()` |

Markdown 没有下划线、折叠块和提及，这些内容写成 HTML，读回时仍能还原。提示块的语气对应 GitHub 的五种提示：`NOTE` 与 `IMPORTANT` 读作 `info`，`TIP` 读作 `tip`，`WARNING` 读作 `warning`，`CAUTION` 读作 `danger`。图片的宽度，表格的表头列、列宽和合并单元格只写入 HTML。

段落、标题等块的子块在 HTML 和 Markdown 中没有对应的嵌套方式，会依次写在它的后面。

加粗、斜体的符号紧贴中文标点时，Markdown 可能无法识别（例如 `**“好”**然后`），这时会改写成 `<strong>` 等标签，保证读回时格式不丢失。

## 自定义块的写法

扩展通过 `output` 声明写法，通过 `prepareHTML` 在读入前整理 HTML：

```ts
import { blockElement, defineExtension, splitContainer, textBlock } from '@dou-ui/editor'

const note = defineExtension({
  name: 'note',
  blocks: {
    note: textBlock('note', {
      parseDOM: [{ tag: 'div[data-content-type="note"]' }],
    }),
  },
  output: {
    blocks: {
      note: {
        html: (block, { content, children }) =>
          `<section class="note"><p>${content}</p>${children}</section>`,
        markdown: (block, { content }) => `NOTE: ${content}`,
      },
    },
  },
  // 把 <section class="note"> 改写成编辑器的块，第一段是块的文字，其余的成为子块
  prepareHTML: (root) => {
    for (const element of root.querySelectorAll('section.note')) {
      const { content, children } = splitContainer(element)
      element.replaceWith(blockElement(element.ownerDocument, 'note', content, children))
    }
  },
})
```

块的写法函数接收块本身和一个上下文：

| 名称       | 说明                                                | 类型     |
| ---------- | --------------------------------------------------- | -------- |
| `content`  | 块的文字，已经写成对应格式                          | `string` |
| `text`     | 块的纯文字，不带格式                                | `string` |
| `children` | 子块，已经写成对应格式                              | `string` |
| `index`    | 在前面连续的同类型块中的序号，从 1 开始（用于编号） | `number` |
| `html`     | 仅 Markdown：块的文字写成的 HTML，用于嵌在 HTML 里  | `string` |

块还可以设置 `group`：连续的、`group` 相同的块会放进同一个元素（例如 `'ul'`），在 Markdown 中彼此之间不空行。行内节点的写法是 `(props) => string`，文字格式的写法是一对开头和结尾的字符串，例如 `{ html: ['<mark>', '</mark>'], markdown: ['==', '=='] }`。

没有声明写法的块写成段落，没有声明写法的文字格式只保留文字。`escapeHTML`、`escapeMarkdown` 和 `indentLines` 可以帮助拼接输出。
