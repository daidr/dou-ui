# 语言

`language` 决定代码的颜色，以及按 `Enter` 时的缩进、注释的写法和自动补全的括号。

## 内置语言

内置语言从 `@dou-ui/code` 按需引入，没有用到的语言不会打包。

<DocDemo src="code/languages" column />

| 导出         | 语言                                                  | 名称与别名                                                           |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `javascript` | JavaScript                                            | `javascript`、`js`、`mjs`、`cjs`                                     |
| `typescript` | TypeScript                                            | `typescript`、`ts`、`mts`、`cts`                                     |
| `jsx`、`tsx` | 带 JSX 的 JavaScript、TypeScript                      | `jsx`、`tsx`                                                         |
| `json`       | JSON，允许注释和末尾逗号                              | `json`、`jsonc`、`json5`                                             |
| `css`        | CSS                                                   | `css`                                                                |
| `scss`       | SCSS 和 Less                                          | `scss`、`less`、`postcss`                                            |
| `html`       | HTML，`<script>` 和 `<style>` 按 JavaScript、CSS 着色 | `html`、`htm`、`xml`、`svg`                                          |
| `vue`        | Vue 单文件组件                                        | `vue`                                                                |
| `markdown`   | Markdown                                              | `markdown`、`md`                                                     |
| `python`     | Python 3                                              | `python`、`py`、`py3`、`pyi`                                         |
| `shell`      | Shell 脚本（Bash、sh、Zsh）                           | `shell`、`sh`、`bash`、`zsh`、`shellscript`                          |
| `sql`        | SQL，常见方言的公共部分                               | `sql`、`postgres`、`postgresql`、`pgsql`、`mysql`、`sqlite`、`plsql` |
| `yaml`       | YAML                                                  | `yaml`、`yml`                                                        |

名称与别名用于 `createCodeHighlighter` 和 Markdown 代码块查找语言，不区分大小写。Vue 文件中 `<script lang="ts">` 按 TypeScript 着色，`<style lang="scss">` 按 SCSS 着色。

### Markdown 中的代码块

Markdown 中的代码块默认不着色。使用 `createMarkdown` 传入需要的语言，代码块会按开头写的语言名着色：

```ts
import { createMarkdown, json, typescript } from '@dou-ui/code'

const markdown = createMarkdown({ languages: [typescript, json] })
```

## 颜色

每种记号的颜色来自主题的 `--dou-color-syntax-*` 变量，切换深色模式时会自动更新。可以用 `createTheme` 或 CSS 覆盖它们：

| 变量                             | 用于                         |
| -------------------------------- | ---------------------------- |
| `--dou-color-syntax-keyword`     | 关键字，CSS 的 `@media` 等   |
| `--dou-color-syntax-string`      | 字符串、正则表达式           |
| `--dou-color-syntax-number`      | 数字，CSS 的长度和颜色值     |
| `--dou-color-syntax-comment`     | 注释                         |
| `--dou-color-syntax-function`    | 函数名、链接                 |
| `--dou-color-syntax-type`        | 类型名，CSS 的类名和 id      |
| `--dou-color-syntax-variable`    | 变量名                       |
| `--dou-color-syntax-property`    | 属性名、对象的键             |
| `--dou-color-syntax-operator`    | 运算符                       |
| `--dou-color-syntax-punctuation` | 括号、逗号等标点             |
| `--dou-color-syntax-tag`         | HTML 和 JSX 标签             |
| `--dou-color-syntax-attribute`   | 标签的属性                   |
| `--dou-color-syntax-meta`        | 实体、Markdown 代码块标记等  |
| `--dou-color-syntax-invalid`     | 无法识别的内容，带波浪下划线 |

对应的类名是 `dou-syntax-keyword` 这样的形式，定义在主题的基础样式中。

### 代码块使用同一套颜色

`createCodeHighlighter` 生成 [CodeBlock](/components/code-block) 的 `highlight` 函数，让代码块和编辑器使用相同的语言和颜色。在 `defaults` 中设置一次即可，列表中没有的语言显示为普通文字：

```ts
import { createCodeHighlighter, css, json, typescript, vue } from '@dou-ui/code'

app.use(DouUI, {
  defaults: {
    DouCodeBlock: { highlight: createCodeHighlighter([typescript, vue, css, json]) },
  },
})
```

## 用 Shiki 支持更多语言

内置语言之外的语言，可以使用 [Shiki](https://shiki.style) 的语法定义。`@dou-ui/code/shiki` 的 `shikiLanguage` 把 Shiki 中加载好的语言转换为编辑器的语言，颜色仍然来自上面的语法颜色变量。

<DocDemo src="code/shiki" column />

编辑器不依赖 Shiki，需要时自行安装：

```ts
import { shikiLanguage } from '@dou-ui/code/shiki'
import { createHighlighter } from 'shiki'

const highlighter = await createHighlighter({ langs: ['rust'], themes: [] })
const rust = shikiLanguage(highlighter, 'rust', {
  comment: { line: '//', block: ['/*', '*/'] },
})
```

- `themes: []` 表示不加载 Shiki 的主题，Shiki 只负责分出记号。
- 在浏览器中可以使用 Shiki 的 JavaScript 正则引擎，不必加载 WebAssembly。
- Shiki 的语法定义中没有注释写法和缩进规则。需要切换注释、换行缩进时，用 `comment`、`brackets`、`autoClose`、`indentAfter` 补充。

## 自定义语言

`defineCodeLanguage` 用一个逐行读取的 `token` 函数定义语言。`token` 每次读取一个记号（至少一个字符），返回它的种类；返回 `null` 表示普通文字。

<DocDemo src="code/custom-language" column />

`stream` 提供 `match`、`next`、`eat`、`peek`、`skipToEnd`、`sol`（是否在行首）等方法。

需要跨行记住的信息（例如是否在多行注释中）放在状态里：`startState` 返回文本开头的状态，它会作为 `token` 的第二个参数传入，可以直接修改。状态只能包含普通的对象、数组、字符串和数字，编辑器会复制和比较状态，以判断修改后需要重新读取多少行。

## API

### defineCodeLanguage(spec)

| 选项          | 说明                                               | 类型                                       |
| ------------- | -------------------------------------------------- | ------------------------------------------ |
| `name`        | 名称                                               | `string`                                   |
| `aliases`     | 别名                                               | `string[]`                                 |
| `token`       | 读取一个记号，返回它的种类                         | `(stream, state) => CodeTokenType \| null` |
| `startState`  | 文本开头的状态                                     | `() => S`                                  |
| `blankLine`   | 读到空行时调用                                     | `(state) => void`                          |
| `comment`     | 注释写法，如 `{ line: '//', block: ['/*', '*/'] }` | `{ line?, block? }`                        |
| `brackets`    | 成对的括号，默认 `'()[]{}'`                        | `string`                                   |
| `autoClose`   | 输入时自动补上另一半的字符，默认是左括号和引号     | `string`                                   |
| `indentAfter` | 光标前的文字匹配时，换行多缩进一级                 | `RegExp`                                   |
| `languageAt`  | 当前状态下正在使用的语言，用于包含其他语言的语言   | `(state) => CodeLanguage \| null`          |
| `nested`      | 可能包含的语言，和 `languageAt` 一起使用           | `CodeLanguage[]`                           |

### shikiLanguage(highlighter, lang, options?)

| 选项                                              | 说明                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `name`、`aliases`                                 | 名称和别名，默认使用 Shiki 中的名称                                             |
| `comment`、`brackets`、`autoClose`、`indentAfter` | 同 `defineCodeLanguage`                                                         |
| `tokenType(scopes)`                               | 按作用域返回颜色种类；返回 `undefined` 时使用内置的对应关系 `tokenTypeOfScopes` |

### 其他导出

| 名称                               | 说明                               |
| ---------------------------------- | ---------------------------------- |
| `createMarkdown({ languages })`    | 创建能给代码块着色的 Markdown 语言 |
| `createCodeHighlighter(languages)` | 创建 CodeBlock 的 `highlight` 函数 |
| `languageFor(languages, name)`     | 按名称或别名在列表中查找语言       |
