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

## 选项

| 名称        | 说明                                   | 类型                                                        | 默认值          |
| ----------- | -------------------------------------- | ----------------------------------------------------------- | --------------- |
| `highlight` | 高亮函数，写法同 Shiki 的 `codeToHtml` | `(code: string, lang: string) => string \| Promise<string>` | 全局 `defaults` |
| `languages` | 语言菜单中的语言                       | `(CodeLanguage \| string)[]`                                | 常用语言        |

`CodeLanguage` 为 `{ value: string; label: string }`，默认列表从 `defaultLanguages` 导出。
