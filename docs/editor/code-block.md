# 代码块

代码块等宽显示代码，右上角可以选择语言、复制代码。接入高亮工具后，代码会按语言高亮。

## 语法高亮

编辑器本身不带语法高亮，高亮函数和 [CodeBlock](/components/code-block) 的 `highlight` 写法相同：接收代码和语言，返回 HTML，可以是 Promise。使用 [Shiki](https://shiki.style) 时，通过 `editorKit` 的 `codeBlock` 选项传入：

```ts
import { editorKit } from '@dou-ui/editor'
import { codeToHtml } from 'shiki'

const highlight = (code: string, lang: string) =>
  codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })

const extensions = [editorKit({ codeBlock: { highlight } })]
```

<DocDemo src="editor/code-block" column />

已经在 `ConfigProvider` 或插件选项的 `defaults` 里给 CodeBlock 设置了 `highlight` 时，编辑器会直接使用它，不需要再传一次。

高亮只改变代码的显示，文档里保存的仍然是纯文本。每次修改后重新高亮，结果出来之前保留上一次的颜色。高亮函数出错时（例如不认识的语言），代码按纯文本显示。

## 语言

语言保存在块的 `language` 属性里，传给高亮函数，为空时按 `text` 处理。语言菜单默认列出常用的语言，`languages` 可以替换这个列表：

```ts
editorKit({
  codeBlock: {
    highlight,
    languages: [
      { value: 'typescript', label: 'TypeScript' },
      { value: 'vue', label: 'Vue' },
      'sql',
    ],
  },
})
```

字符串同时作为语言的值和显示的名称。粘贴进来的代码会从 `<code class="language-…">` 读取语言；不在列表里的语言也会显示在菜单中。

## 用代码编辑器编辑

`@dou-ui/editor/code` 提供的 `codeEditorBlock` 把代码块换成[代码编辑器](/code/)：输入时即时着色，支持括号匹配、多光标、搜索替换和按语言缩进。它需要安装 `@dou-ui/code` 并引入它的样式：

```ts
import '@dou-ui/code/style'
import { editorKit } from '@dou-ui/editor'
import { codeEditorBlock } from '@dou-ui/editor/code'

const extensions = [editorKit({ codeBlock: codeEditorBlock() })]
```

<DocDemo src="editor/code-editor-block" column />

文档里的数据和内置代码块相同，仍是带 `language` 属性的 `codeBlock`，导出的 HTML 和 Markdown 也一样，两种代码块可以随时切换。代码里的每次修改都作为文档的一步修改，所以撤销和重做与其他块共用一份历史，协同编辑、拖动块也照常工作。

在代码块里：

- 光标在第一行按 `↑`、在开头按 `←` 回到上一个块；在最后一行按 `↓`、在末尾按 `→` 进入下一个块。
- `Mod` + `Enter` 在代码块后面新建一个段落；代码为空时按 `Backspace` 把它变成段落。
- `Esc` 选中整个块，之后可以拖动、复制或删除。有多个光标或打开了搜索时，先退出它们。

语言菜单默认列出 `@dou-ui/code` 内置的语言，块的 `language` 按语言的名称和别名查找，所以 `bash`、`sh` 都显示为 Shell。用 Shiki 支持的其他语言见[代码编辑器的语言](/code/languages#用-shiki-支持更多语言)，传给 `languages`：

```ts
import { codeEditorBlock, codeEditorLanguages } from '@dou-ui/editor/code'

// rust 由 shikiLanguage(highlighter, 'rust') 得到
codeEditorBlock({
  languages: [...codeEditorLanguages, { language: rust, label: 'Rust' }],
  lineNumbers: true,
})
```

| 名称          | 说明                                     | 类型                                     | 默认值                |
| ------------- | ---------------------------------------- | ---------------------------------------- | --------------------- |
| `languages`   | 语言菜单中的语言，不带名字时用语言的名称 | `(CodeLanguage \| CodeEditorLanguage)[]` | `codeEditorLanguages` |
| `lineNumbers` | 显示行号                                 | `boolean`                                | `false`               |
| `wrap`        | 长行自动换行，否则左右滚动               | `boolean`                                | `false`               |
| `tabSize`     | 制表符宽度，也是缩进的空格数             | `number`                                 | `2`                   |
| `extensions`  | 每个代码块的编辑器都使用的扩展，例如补全 | `CodeExtension[]`                        | —                     |

`CodeLanguage` 和 `CodeExtension` 来自 `@dou-ui/code`，`CodeEditorLanguage` 为 `{ language: CodeLanguage; label: string }`。

## 内置代码块的选项

| 名称        | 说明                                   | 类型                                                        | 默认值          |
| ----------- | -------------------------------------- | ----------------------------------------------------------- | --------------- |
| `highlight` | 高亮函数，写法同 Shiki 的 `codeToHtml` | `(code: string, lang: string) => string \| Promise<string>` | 全局 `defaults` |
| `languages` | 语言菜单中的语言                       | `(CodeLanguage \| string)[]`                                | 常用语言        |

`CodeLanguage` 为 `{ value: string; label: string }`，默认列表从 `defaultLanguages` 导出。
