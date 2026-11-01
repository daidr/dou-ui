# 代码编辑器

`@dou-ui/code` 提供代码编辑器 `DouCodeEditor`：一块等宽字体、带行号的可编辑文本区域。它按语言给代码着色，自动缩进、补全括号、切换注释；十万行的文件也能马上打开、流畅输入和滚动，中文输入法在光标处直接组字，可以同时有多个选区。适合做配置编辑、脚本输入、代码练习这类“编辑一段代码”的界面。

只是展示一段代码时，用 [CodeBlock 代码块](/components/code-block) 更合适。

## 安装

代码编辑器是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/code
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/code/style.css'
import { DouCodeEditor } from '@dou-ui/code'

app.use(DouCodeEditor)
```

## 基础用法

`v-model` 绑定代码字符串。编辑器的高度随内容增长；内容较多时，用 `style` 或 CSS 给它一个高度或最大高度，超出的部分在编辑器里滚动。

<DocDemo src="code/basic" column />

字符串里的 `\r\n` 和 `\r` 都按换行读入，交回的字符串统一用 `\n`。

## 语言

`language` 设置代码的语言。语言决定代码怎么着色，也决定按 `Enter` 时怎么缩进、注释用什么符号、哪些括号成对输入。内置的语言从 `@dou-ui/code` 按需引入，没用到的不会打包。`createCodeHighlighter` 和 Markdown 代码块按名称或别名找语言，不区分大小写：

| 导出         | 语言                                                  | 名称与别名（`lang` 可以写的值）                                      |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `javascript` | JavaScript                                            | `javascript`、`js`、`mjs`、`cjs`                                     |
| `typescript` | TypeScript                                            | `typescript`、`ts`、`mts`、`cts`                                     |
| `jsx`、`tsx` | 带 JSX 的 JavaScript、TypeScript                      | `jsx`、`tsx`                                                         |
| `json`       | JSON，也允许注释和末尾逗号                            | `json`、`jsonc`、`json5`                                             |
| `css`        | CSS                                                   | `css`                                                                |
| `scss`       | SCSS 和 Less：嵌套规则、`//` 注释与 `$` 变量          | `scss`、`less`、`postcss`                                            |
| `html`       | HTML，`<script>` 和 `<style>` 里按 JavaScript、CSS 读 | `html`、`htm`、`xml`、`svg`                                          |
| `vue`        | Vue 单文件组件，模板里的 `{{ }}` 和指令值按表达式读   | `vue`                                                                |
| `markdown`   | Markdown                                              | `markdown`、`md`                                                     |
| `python`     | Python 3，含类型标注、装饰器和三引号字符串            | `python`、`py`、`py3`、`pyi`                                         |
| `shell`      | Shell 脚本（Bash、sh、Zsh），含 here-document         | `shell`、`sh`、`bash`、`zsh`、`shellscript`                          |
| `sql`        | SQL，常见方言共有的部分，关键字不区分大小写           | `sql`、`postgres`、`postgresql`、`pgsql`、`mysql`、`sqlite`、`plsql` |
| `yaml`       | YAML，含多行文本、锚点和引用                          | `yaml`、`yml`                                                        |

<DocDemo src="code/languages" column />

`<script lang="ts">` 按 TypeScript 读，`<style lang="scss">` 按 SCSS 读。Markdown 的代码块默认只显示成一种颜色；要按语言着色，用 `createMarkdown` 的 `languages` 传入会用到的语言，按代码块开头写的语言名或别名选用：

```ts
import { createMarkdown, typescript, json } from '@dou-ui/code'

const markdown = createMarkdown({ languages: [typescript, json] })
```

### 用 Shiki 支持更多语言

内置语言之外的语言可以借助 [Shiki](https://shiki.style) 的语法定义。`@dou-ui/code/shiki` 的 `shikiLanguage` 把 Shiki 高亮器里加载好的语言转成编辑器的语言：仍然按行读取、只重读改动的部分，各种记号映射到上面的语法颜色，所以主题和深色模式照样生效。编辑器不依赖 Shiki，用到时自己安装：

```ts
import { shikiLanguage } from '@dou-ui/code/shiki'
import { createHighlighter } from 'shiki'

const highlighter = await createHighlighter({ langs: ['rust'], themes: [] })
const rust = shikiLanguage(highlighter, 'rust', {
  comment: { line: '//', block: ['/*', '*/'] },
})
```

Shiki 的语法定义里没有注释写法和缩进规则，需要切换注释、换行缩进时，用 `comment`、`brackets`、`autoClose`、`indentAfter` 补上，写法和自定义语言一样。`name`、`aliases` 改变它的名称；`tokenType(scopes)` 可以改变某些作用域对应的颜色种类，返回 `undefined` 时用内置的对应关系，`tokenTypeOfScopes(scopes)` 就是这套对应关系。

`themes: []` 表示不加载 Shiki 的主题：颜色来自编辑器自己的语法颜色变量，Shiki 只负责分出记号。在浏览器里可以用 Shiki 的 JavaScript 正则引擎，不必加载 WebAssembly。下面的示例在打开时才加载 Shiki 和 Rust、Go 两种语法：

<DocDemo src="code/shiki" column />

着色只针对看得见的行，以及它们之前必须读过的行。修改之后从改动的行重新读起，读到某一行开头的状态和修改前一样就停下，所以在长文件里输入只重读一两行。直接跳到很远的地方时，那里先显示为没有颜色的文字，空闲时间读到之后再着色。

### 颜色

每种记号的颜色来自主题的 `--dou-color-syntax-*` 变量，切换暗色不需要重新读代码。也可以和其他主题变量一样，用 `createTheme` 或 CSS 覆盖：

| 变量                             | 用于                        |
| -------------------------------- | --------------------------- |
| `--dou-color-syntax-keyword`     | 关键字，CSS 的 `@media` 等  |
| `--dou-color-syntax-string`      | 字符串、正则表达式          |
| `--dou-color-syntax-number`      | 数字，CSS 的长度和颜色值    |
| `--dou-color-syntax-comment`     | 注释                        |
| `--dou-color-syntax-function`    | 函数名、链接                |
| `--dou-color-syntax-type`        | 类型名，CSS 的类名和 id     |
| `--dou-color-syntax-variable`    | 变量名                      |
| `--dou-color-syntax-property`    | 属性名、对象的键            |
| `--dou-color-syntax-operator`    | 运算符                      |
| `--dou-color-syntax-punctuation` | 括号、逗号等标点            |
| `--dou-color-syntax-tag`         | HTML 和 JSX 标签            |
| `--dou-color-syntax-attribute`   | 标签的属性                  |
| `--dou-color-syntax-meta`        | 实体、Markdown 代码块标记等 |
| `--dou-color-syntax-invalid`     | 读不懂的内容，带波浪下划线  |

着色用的类名是 `dou-syntax-keyword` 这样的形式，写在主题的基础样式里，所以 CodeBlock 也能使用。

### 代码块使用同一套颜色

`createCodeHighlighter` 生成一个 [CodeBlock](/components/code-block) 的 `highlight` 函数，用同样的语言和颜色给代码块着色。在 `defaults` 里设置一次，所有代码块都会使用；列表里没有的语言显示为普通文字：

```ts
import { createCodeHighlighter, css, json, typescript, vue } from '@dou-ui/code'

app.use(DouUI, {
  defaults: {
    DouCodeBlock: { highlight: createCodeHighlighter([typescript, vue, css, json]) },
  },
})
```

### 自定义语言

`defineCodeLanguage` 用一个按行读取的 `token` 函数定义语言。每次调用读一个记号（至少一个字符）并返回它的种类，返回 `null` 表示普通文字；`stream` 提供 `match`、`next`、`eat`、`peek`、`skipToEnd`、`sol`（是否在行首）等方法：

<DocDemo src="code/custom-language" column />

需要跨行的信息（比如多行注释）放在状态里：`startState` 返回文本开头的状态，`token` 的第二个参数就是它，可以直接修改。状态应当是普通的对象、数组、字符串和数字，编辑器会复制和比较它，判断从哪一行起不必重读。其他选项：

| 选项          | 说明                                                                       |
| ------------- | -------------------------------------------------------------------------- |
| `name`        | 名称，`createCodeHighlighter` 按它和 `aliases` 匹配 `lang`                 |
| `aliases`     | 别名，如 `['js', 'mjs']`                                                   |
| `startState`  | 文本开头的状态                                                             |
| `comment`     | 注释写法：`{ line: '//', block: ['/*', '*/'] }`                            |
| `brackets`    | 成对的括号，默认 `'()[]{}'`                                                |
| `autoClose`   | 输入时自动补上另一半的字符，写成一个字符串，默认是左括号和 `'"`            |
| `indentAfter` | 光标前的文字符合这个正则时，换行多缩进一级                                 |
| `languageAt`  | 状态里正在使用的语言，用于包含其他语言的语言（HTML 里的 `<script>`）       |
| `nested`      | 可能包含的语言，和 `languageAt` 一起用；在 worker 里分词时按名称在这里查找 |

## 编辑辅助

设置了 `language` 之后：

- 按 `Enter` 保留缩进；光标前是左括号（或 HTML 的开始标签）时多缩进一级，光标在一对括号之间时，右括号单独放到下一行。在空行上输入右括号，会对齐到与它配对的左括号所在行的缩进。
- 输入左括号或引号时同时补上另一半，光标留在中间；再输入右括号或引号时跳过已经补上的那个。有选区时，输入括号或引号会把选区包起来。字母后面的引号（如 `it's`）、字符串和注释里的括号不会自动补全。在一对空括号之间按 `Backspace` 两边一起删除。`close-brackets` 设为 `false` 可以关闭这些。
- 光标挨着括号时，它和配对的括号会加上细边框；找不到配对时边框是红色。字符串和注释里的括号不参与配对。`match-brackets` 设为 `false` 可以关闭。
- `Mod` + `/` 注释或取消注释所在的行，在 Vue 或 HTML 的 `<script>` 里用 `//`，在模板里用 `<!-- -->`。

## 选择与光标

点击放下光标，拖动选择，双击选中一个词，三击选中一行；按住 `Shift` 点击扩大选区。点击行号选中整行，在行号上拖动选中多行。拖到编辑器边缘时会自动滚动。

`v-model:selection` 读写选区：`ranges` 是选中的范围，每个范围的 `anchor` 是起点，`head` 是光标所在的一端，两者相等就是一个光标；`main` 是主选区的序号。位置是从文本开头数起的偏移，按 UTF-16 计数，和浏览器、语言服务的约定一致。

<DocDemo src="code/selection" column />

按住 `Alt`（Apple 上是 `⌥`）点击，在点击处加一个光标；按住拖动则加一个选区。有多个选区时，输入、删除、粘贴会作用到每一个上；粘贴的行数和选区个数相同时，每个选区各得一行。按 `Esc` 只留下主选区。也可以用 `v-model:selection` 或 `select()` 从代码里设置多个选区。

### 多光标

- `Mod` + `D` 选中光标处的词，再按一次选中下一个相同的词，依次添加选区；`Mod` + `Shift` + `L` 一次选中所有相同的词。选中的是一个完整的词时，只找同样是完整词的地方。
- `Ctrl` + `Alt` + `↑` / `↓`（Apple 上是 `⌥` + `⌘` + `↑` / `↓`）在上一行或下一行同一列加一个光标。
- 按住 `Alt` + `Shift`（Apple 上是 `⌥` + `Shift`）拖动，按列选择一个矩形区域：每一行各得一个选区，短的行只放一个光标在行尾。

双击选中一个词，三击或点击行号选中一整行；双击、三击后继续拖动，会按词或按行扩大选区。

光标按用户看到的字符移动：一个 emoji 或带声调的字母是一个字符，不会停在中间。按词移动时，中文按浏览器的分词结果切分，而不是把一整段中文当成一个词。

## 查找与替换

按 `Mod` + `F` 打开查找面板，选中的文字会填进查找框；没有选中时填入光标所在的词。`Enter` 和 `Shift` + `Enter` 跳到下一个、上一个匹配，`Esc` 关闭面板并回到编辑器。查找框右侧的三个开关分别是区分大小写、全词匹配和正则表达式；正则写法有误时查找框标红。

所有匹配都会加上浅色底，光标所在的那个再加一圈边框；编辑器右侧靠近滚动条的位置标出匹配在整个文本中的分布。边输入边查找，第一个匹配会被选中并滚动到可见。

按 `Mod` + `H`（Apple 上是 `⌥` + `⌘` + `F`），或点击面板左侧的箭头，展开替换框；焦点在面板里时这个按键同样有效。替换框里按 `Enter` 替换当前的匹配并跳到下一个，按 `Mod` + `Enter` 全部替换，全部替换只算一次修改，撤销一次就能还原。用正则查找时，替换文字里可以用 `$1`、`$<name>` 引用分组，`$&` 是整个匹配，`$$` 是 `$` 本身。只读的编辑器里只能查找。

<DocDemo src="code/search" column />

`openSearch(query?)` 用代码打开面板，并可以带上查找的内容与选项，带上 `replace` 时同时展开替换框；`closeSearch()` 关闭面板。触屏设备上没有这些按键，需要时自己放一个按钮调用 `openSearch()`。`searchable` 设为 `false` 不提供查找面板，`Mod` + `F` 交还给浏览器，`openSearch()` 也返回 `false`。面板是 [FindReplace](../components/find-replace)，上面的文字（包括区分大小写、全词匹配、正则表达式这几个开关）在 [ConfigProvider](../components/config-provider) 语言包的 `findReplace` 里。

在编辑器之外查找文本，可以直接用 `searchText`：

```ts
import { CodeText, replacementFor, searchText } from '@dou-ui/code'

const doc = CodeText.of('let a = 1\nlet b = 2')
const query = { search: 'let (\\w)', regexp: true, replace: 'const $1' }
const { matches } = searchText(doc, query) // [{ from: 0, to: 5 }, { from: 10, to: 15 }]
replacementFor(doc, matches[0], query) // 'const a'
```

一次最多统计一万个匹配，更多时面板显示“超过 10000 个”，全部替换仍然会替换所有匹配。

## 输入法

焦点在一个看不见的输入框上，它跟着光标走，所以输入法的候选框出现在光标处。组字时，拼音直接显示在光标位置并带下划线，确认后才写入文本；组字期间按下的 `Enter`、方向键等都交给输入法，不会触发编辑器的快捷键，确认候选词的 `Enter` 也不会多换一行。

手机上轻点放下光标并弹出键盘，单指滑动是滚动；按住片刻选中一个词。键盘的空格键拖动光标、自动更正和语音输入都能正常使用。输入框的字号至少是 16px，避免手机在聚焦时自动放大页面。

## 键盘操作

`Mod` 在 Apple 设备上是 `⌘`，在其他系统上是 `Ctrl`。

| 按键                                                 | 作用                                              |
| ---------------------------------------------------- | ------------------------------------------------- |
| 方向键                                               | 移动一个字符或一行，上下移动时保持列的位置        |
| `Alt` / `Ctrl` + `←` `→`                             | 按词移动（Apple 设备上用 `⌥`，其他用 `Ctrl`）     |
| `Home` / `End`，Apple 上也可 `⌘` + `←` `→`           | 移到行首或行尾；行首先停在缩进之后                |
| `Mod` + `Home` / `End`，Apple 上 `⌘` + `↑` `↓`       | 移到文本开头或结尾                                |
| `PageUp` / `PageDown`                                | 翻一屏                                            |
| 以上按键加 `Shift`                                   | 扩大选区                                          |
| `Backspace` / `Delete`                               | 删除一个字符；有选区时删除选区                    |
| `Alt` / `Ctrl` + `Backspace`                         | 删除一个词；Apple 上 `⌘` + `Backspace` 删到行首   |
| `Enter`                                              | 换行，并保留当前行的缩进                          |
| `Tab` / `Shift` + `Tab`                              | 缩进到下一个制表位 / 减少缩进；选中多行时整体缩进 |
| `Mod` + `]` / `[`                                    | 增加 / 减少所在行的缩进                           |
| `Mod` + `A`                                          | 全选                                              |
| `Mod` + `Z`，`Mod` + `Shift` + `Z` 或 `Ctrl` + `Y`   | 撤销，重做                                        |
| `Esc`                                                | 只留下主选区；之后按 `Tab` 会离开编辑器           |
| `Mod` + `/`                                          | 注释或取消注释所在的行                            |
| `Alt` + `↑` / `↓`                                    | 把所在的行上移 / 下移一行                         |
| `Shift` + `Alt` + `↑` / `↓`                          | 把所在的行复制到上方 / 下方                       |
| `Mod` + `Shift` + `K`                                | 删除所在的行                                      |
| `Mod` + `Shift` + `\`                                | 移到配对的括号                                    |
| `Mod` + `D` / `Mod` + `Shift` + `L`                  | 选中下一个相同的词 / 所有相同的词                 |
| `Ctrl` + `Alt` + `↑` / `↓`，Apple 上 `⌥` + `⌘`       | 在上一行 / 下一行加一个光标                       |
| `Mod` + `F`，`Mod` + `H`（Apple 上 `⌥` + `⌘` + `F`） | 打开查找 / 替换                                   |
| `F3` 或 `Mod` + `G`，加 `Shift` 反向                 | 跳到下一个 / 上一个匹配                           |
| `Ctrl` + `Space` 或 `Alt` + `Esc`                    | 打开补全（需要扩展提供补全）                      |
| `Mod` + `I`                                          | 显示光标处的说明                                  |

编辑器里 `Tab` 用来缩进。只用键盘时，先按 `Esc` 再按 `Tab`，焦点就会移到页面上的下一个元素。

`keymap` 属性添加或覆盖按键，见[用代码修改](#用代码修改)。

## 撤销与重做

连续输入或连续删除会合成一步撤销，停顿超过半秒、移动过光标或换了一种操作就开始新的一步。撤销后选区回到修改前的位置。通过组件实例调用 `undo()`、`redo()`，用 `canUndo`、`canRedo` 控制按钮状态。

`v-model` 在外面被改成新的字符串时，编辑器只算出改动的那一段，作为一次修改应用：光标留在原来的内容上，这次修改也能撤销。

[协同编辑](/code/collaboration)时，撤销和重做只针对自己的修改，由协同扩展接管。

## 用代码修改

组件实例的 `transact(run)` 做一次修改：在 `run` 里调用 `tr.replace(from, to, text)`、`tr.insert(pos, text)`、`tr.delete(from, to)` 或 `tr.replaceSelection(text)`，整次修改算一步撤销。同一次修改里的所有位置都按修改**之前**的文本计算，后面的调用不用考虑前面插入或删除带来的偏移；各处修改不能重叠。没有调用 `tr.select()` 时，选区随修改移动。

<DocDemo src="code/transact" column />

示例里“用 log() 包起选区”把每个选区换成 `log(选中的文字)`，光标处没有选中文字时插入一个空的 `log()`；“在每行前加 //”在每个非空行的开头插入 `// `，这些插入用的都是修改前的位置。

`tr.doc` 是修改前的文本（`CodeText`）：`lines` 是行数，`line(n)` 取第 n 行（从 1 开始），`lineAt(pos)` 取某个位置所在的行，`slice(from, to)` 取一段文字。

每次修改之后触发 `transaction` 事件，参数里有 `changes`（这次的改动）、`before` 和 `state`（修改前后的文本与选区），`meta.action` 说明修改的来源：`input` 输入、`delete` 删除、`paste` 粘贴、`cut` 剪切、`undo` / `redo`、`external` 来自新的 `v-model` 值等。

`codeCommands` 里是内置的编辑和移动命令，用 `run(command)` 执行。在按钮里执行命令后，焦点还在按钮上，需要接着输入时再调用 `focus()`。`keymap` 属性传入额外的按键，键名的写法和 `useHotkey` 一样（`mod+shift+k`），值是要执行的命令，比内置按键优先；命令返回 `false` 时继续尝试下一个绑定：

```ts
import { codeCommands, type CodeKeymap } from '@dou-ui/code'

const keymap: CodeKeymap = {
  'mod+s': () => (save(), true),
  'mod+d': codeCommands.selectAll,
}
```

内置命令及默认按键（`Mod` 的含义同上，“Apple” 一列只写和其他系统不同的按键）：

| 命令                                       | 作用                                  | 默认按键                                          | Apple                                               |
| ------------------------------------------ | ------------------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| `cursorCharLeft` / `cursorCharRight`       | 左右移动一个字符；有选区时移到选区边  | `←` / `→`                                         |                                                     |
| `cursorWordLeft` / `cursorWordRight`       | 按词移动                              | `Ctrl` + `←` / `→`                                | `⌥` + `←` / `→`                                     |
| `cursorLineStart` / `cursorLineEnd`        | 移到行首（先停在缩进之后）/ 行尾      | `Home` / `End`                                    | 另有 `⌘` + `←` / `→`                                |
| `cursorLineUp` / `cursorLineDown`          | 上下移动一行，保持列的位置            | `↑` / `↓`                                         |                                                     |
| `cursorPageUp` / `cursorPageDown`          | 翻一屏                                | `PageUp` / `PageDown`                             |                                                     |
| `cursorDocStart` / `cursorDocEnd`          | 移到文本开头 / 结尾                   | `Ctrl` + `Home` / `End`                           | `⌘` + `↑` / `↓`                                     |
| `select…`（如 `selectWordLeft`）           | 和同名的 `cursor…` 一样移动，扩大选区 | 对应按键加 `Shift`                                | 对应按键加 `Shift`                                  |
| `selectAll`                                | 全选                                  | `Mod` + `A`                                       |                                                     |
| `simplifySelection`                        | 只留下主选区；只有一个时取消选中      | `Esc`                                             |                                                     |
| `deleteCharBackward` / `deleteCharForward` | 删除前 / 后一个字符，或删除选区       | `Backspace` / `Delete`                            |                                                     |
| `deleteWordBackward` / `deleteWordForward` | 删除前 / 后一个词                     | `Ctrl` + `Backspace` / `Delete`                   | `⌥` + `Backspace` / `Delete`                        |
| `deleteLineStart` / `deleteLineEnd`        | 删到行首 / 行尾                       | 无                                                | `⌘` + `Backspace` / `Delete`，`Ctrl` + `K` 删到行尾 |
| `insertNewline`                            | 换行，保留缩进                        | `Enter`                                           |                                                     |
| `insertTab`                                | 插入缩进；选中多行时整体缩进          | `Tab`                                             |                                                     |
| `indentMore` / `indentLess`                | 增加 / 减少所在行的缩进               | `Mod` + `]` / `[`，减少还有 `Shift` + `Tab`       |                                                     |
| `undo` / `redo`                            | 撤销 / 重做                           | `Mod` + `Z` / `Mod` + `Shift` + `Z`、`Ctrl` + `Y` |                                                     |
| `toggleComment`                            | 注释或取消注释所在的行                | `Mod` + `/`                                       |                                                     |
| `moveLineUp` / `moveLineDown`              | 把所在的行上移 / 下移                 | `Alt` + `↑` / `↓`                                 | `⌥` + `↑` / `↓`                                     |
| `copyLineUp` / `copyLineDown`              | 把所在的行复制到上方 / 下方           | `Shift` + `Alt` + `↑` / `↓`                       | `Shift` + `⌥` + `↑` / `↓`                           |
| `deleteLine`                               | 删除所在的行                          | `Mod` + `Shift` + `K`                             |                                                     |
| `cursorMatchingBracket`                    | 移到配对的括号前                      | `Mod` + `Shift` + `\`                             |                                                     |
| `selectNextOccurrence`                     | 选中光标处的词，或加选下一个相同的    | `Mod` + `D`                                       |                                                     |
| `selectAllOccurrences`                     | 选中所有相同的词                      | `Mod` + `Shift` + `L`                             |                                                     |
| `addCursorAbove` / `addCursorBelow`        | 在上一行 / 下一行加一个光标           | `Ctrl` + `Alt` + `↑` / `↓`                        | `⌥` + `⌘` + `↑` / `↓`                               |
| `openSearch` / `openReplace`               | 打开查找 / 替换面板                   | `Mod` + `F` / `Mod` + `H`                         | `⌘` + `F` / `⌥` + `⌘` + `F`                         |
| `findNext` / `findPrevious`                | 跳到下一个 / 上一个匹配               | `F3`、`Mod` + `G` / 加 `Shift`                    |                                                     |
| `closeSearch`                              | 关闭查找面板                          | `Esc`                                             |                                                     |
| `foldCode` / `unfoldCode`                  | 折叠 / 展开光标所在的一段             | `Ctrl` + `Shift` + `[` / `]`                      | `⌥` + `⌘` + `[` / `]`                               |
| `foldAll` / `unfoldAll`                    | 折叠所有最外层的段 / 全部展开         | 无                                                |                                                     |
| `nextDiagnostic` / `previousDiagnostic`    | 跳到下一个 / 上一个问题               | `F8` / `Shift` + `F8`                             |                                                     |
| `showFixes`                                | 显示光标处问题的修复办法              | `Mod` + `.`                                       |                                                     |

`codeCommands.insertText(target, text)` 不是按键命令：它像输入一样在每个光标处输入一个字符，并处理括号补全和右括号对齐，处理了返回 `true`。`codeCommands.typeText(text)` 返回一个命令，像键盘输入一样输入一段文字，适合做成按钮，符号栏就是用它输入的。

## 自动换行与折叠

`wrap` 让长行在编辑器的宽度处换行，不再横向滚动。换行优先在空格处，中文可以在任意两个字之间断开；一个词比一行还长时从中间断开。换出来的行和原来那一行的缩进对齐。上下方向键按显示出来的行移动，光标在一行长代码里也能逐行上下。

行号旁边的箭头折叠一段代码：鼠标移到行号上时显示，折叠后一直显示；在触屏上箭头一直显示。设置了 `language` 时，以左括号结尾的行折叠到对应的右括号之前，右括号留在原处；其他行折叠下面缩进更深的行。折叠后行尾显示 `⋯`，点击它或箭头展开。光标移进被折叠的部分（比如查找跳到那里）时会自动展开。

<DocDemo src="code/wrap-fold" column />

`Ctrl` + `Shift` + `[` / `]`（Apple 上是 `⌥` + `⌘` + `[` / `]`）折叠、展开光标所在的一段。实例方法 `fold(line?)`、`unfold(line?)`、`foldAll()`、`unfoldAll()` 用代码折叠，`line` 是从 1 开始的行号，和行号栏一致；它们返回 `boolean`，表示有没有折叠或展开。`folds` 是现在折叠着的各段的起始行号。折叠状态变化时触发 `fold-change` 事件，参数也是各段的起始行号，保存下来，之后逐个传给 `fold(line)` 就能恢复。用键盘折叠、展开时，读屏会读出折叠了哪几行。折叠是视图的状态，不影响 `v-model`；不需要折叠时把 `foldable` 设为 `false`。

## 手机触控

在触屏上，轻点放置光标并弹出键盘，光标下方出现一个把手，拖动它移动光标；再点一下光标，弹出粘贴、全选的工具条。长按选中一个词，不松手继续滑动按词扩大选区；选区两端各有一个把手，拖动时手指上方显示放大的当前行。选好后选区上方出现剪切、复制、粘贴、全选的工具条，按 `Esc`、点别处或修改文字后收起。手指在文字上滑动仍然是滚动，只有长按和拖把手才会选择。

编辑器获得焦点时，键盘上方显示一条符号栏：左侧可以横向滑动，有 `Tab`、各种括号和代码里常用的符号，以及撤销、重做；右侧固定四个方向键，按住会连续移动。符号栏输入的括号和引号与键盘输入一样会自动补全。键盘弹出或收起时，编辑器会滚动，让光标留在键盘和符号栏上方。

`keys` 传数组可以改写左侧可以滑动的按键，字符串表示输入它本身的按键；设为 `false` 不显示符号栏。符号栏也可以单独使用：`DouCodeKeys` 通过 `editor` 绑定一个编辑器，放在页面里的任何位置，下面的例子在桌面上把它放在编辑器下方，用鼠标也能点；在触屏上用的是编辑器自带的那一条。

<DocDemo src="code/touch" column />

自定义按键时，`defaultCodeKeys` 是默认那一串按键，展开它再加上自己的，就不用把整串重写一遍。`text` 是按下时输入的文字；`command` 用来做输入以外的操作，比如切换注释：

```ts
import { codeCommands, defaultCodeKeys } from '@dou-ui/code'

const keys = [
  ...defaultCodeKeys,
  { label: '=>', text: ' => ' },
  { label: '//', command: codeCommands.toggleComment, ariaLabel: '切换注释' },
]
```

`CodeKey` 的字段：

| 名称        | 说明                                       | 类型          |
| ----------- | ------------------------------------------ | ------------- |
| `label`     | 按键上显示的文字；有 `icon` 时是按键的名称 | `string`      |
| `text`      | 按下时输入的文字，默认是 `label`           | `string`      |
| `command`   | 按下时执行的命令，代替输入                 | `CodeCommand` |
| `icon`      | 代替文字显示的图标                         | `Component`   |
| `repeat`    | 按住时连续触发                             | `boolean`     |
| `ariaLabel` | 读屏读出的名称，`label` 说不清楚时使用     | `string`      |

## 扩展

扩展用 `defineCodeExtension` 定义，通过 `extensions` 传给编辑器。一个扩展可以提供下面这些部分，都是可选的：

| 名称          | 说明                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`        | 扩展的名字，用来区分各个扩展找到的问题                                                                                                                 |
| `priority`    | 优先级，默认 `100`，大的先执行，它的按键也先尝试                                                                                                       |
| `keymap`      | 返回按键表的函数，写法和 `keymap` 属性一样；比内置的优先，比 `keymap` 属性靠后                                                                         |
| `decorations` | 装饰：给一段文字加 class（`mark`，可以带 `style`），给整行加 class（`line`），或在行内放小部件（`inline`）                                             |
| `gutters`     | 行号左侧的列（`name`、`width`、`markers`、`onPress`），每行可以放图标或文字，可以响应点击                                                              |
| `widgets`     | 插在两行之间的组件（`id`、`pos` 或 `line`、`position`、`render`、`height`、`label`），比如审阅评论                                                     |
| `hide`        | 返回不显示的行（`{ from, to }`，行号从 1 开始，两端都不显示），比如对比时收起的行；上下移动光标会跳过它们，原处不留标记，需要时自己放一个小部件        |
| `panels`      | 编辑器上方或下方的栏（`name`、`position`、`render`），在边框之内                                                                                       |
| `lint`        | 找出文本里的问题，可以返回 Promise                                                                                                                     |
| `transaction` | 每次修改应用之前调用，可以在同一次修改里追加改动；撤销、重做、新的 `v-model` 值和其他人的修改不经过这里                                                |
| `update`      | 每一步应用之后调用，参数是这一步的结果（`changes`、`state`、`before`、`meta`），包括撤销、重做、新的 `v-model` 值和其他人的修改，用 `meta.action` 区分 |
| `history`     | 返回 `{ undo, redo, canUndo, canRedo, close? }`，替换内置的撤销记录，比如协同时只撤销自己的修改；有多个时用第一个                                      |
| `setup`       | 编辑器挂载后调用一次，返回的函数在卸载时调用                                                                                                           |

这些函数的参数是编辑器的上下文：它就是编辑器实例（`doc`、`selection`、`transact`、`run` 等都在上面），另外还有 `visible`（可见的行，`{ from, to }` 是行号，不是文本位置，两端都包含）、`diagnostics`（现在的所有问题）和 `announce(message)`（让读屏读出一句话）。`decorations` 和 `panels` 在绘制时调用，里面读到的响应式数据变化时会重新调用；`decorations` 只需要给出可见的行，大文件里也不会变慢。

`mark` 和 `line` 只改变文字的样子，比如颜色、底色、下划线、边框，不改变字的大小和粗细，这样光标仍然落在字符上。`mark` 的 `style` 是一组行内样式，适合放每个人不同的颜色这类没法写成固定 class 的值，比如 `{ '--my-color': '#3b6ea8' }`；几个 `mark` 重叠时，后面的覆盖前面的。

<DocDemo src="code/extension" column />

在面板或侧栏里渲染的组件可以用 `useCodeEditor()` 拿到同一个上下文。

### 小部件

行内小部件是 `{ type: 'inline', pos, render, width?, id? }`，画在位置 `pos` 的字符前面，比如颜色值前的色块、参数名提示。它不是文字：光标会跳过它，复制时也不包含它。给出 `width`（px）时直接按这个宽度排版；不给时画出来以后再量，量到的宽度按 `id` 记住，位置会变的小部件最好给出 `id`。自动换行时，换行的位置不计入小部件的宽度。

行间小部件由扩展的 `widgets` 返回，每一项是 `{ id, pos 或 line, position?, render, height?, label? }`，画在位置 `pos` 所在行（或第 `line` 行）的下面（`position: 'above'` 时在上面），横跨整个编辑区，下面的行会让出位置。和装饰不同，`widgets` 要给出全部文本里的小部件，因为它们的高度决定了后面每一行的位置，所以数量不宜太多。没画过的小部件按 `height` 估计高度（默认一行），画出来以后按实际高度排版。小部件里可以放输入框和按钮，在里面点击不会移动光标；用键盘时，先按 `Esc` 再按 `Tab` 离开文字，就会进入小部件里的按钮。`label` 是小部件的名称，光标移到它所在的行时，读屏会读出来。

小部件的位置由扩展自己保存。下面的例子把评论的位置存成文本位置 `pos`，在 `transaction` 事件里用 `changes.mapPos` 跟着修改移动：

<DocDemo src="code/widgets" column />

### 诊断

问题的形状是 `{ from, to, severity, message, source?, actions? }`，`from`、`to` 是文本里的位置，`severity` 是 `error`、`warning`、`info`、`hint` 之一。问题在文字下面画波浪线，在行号左侧显示图标，在滚动条上留下标记；鼠标停在上面会显示说明和 `actions` 里的修复办法。

问题有两个来源：`diagnostics` 属性，以及扩展的 `lint`。`lint` 在编辑器挂载时运行，之后在文字停止变化一小会儿后再运行；返回的是 Promise 时，如果结果回来时文字又改过了，这次结果会被丢掉，等下一次运行。两次运行之间，已经找到的问题会跟着修改移动。从 `diagnostics` 属性传入的问题也一样，直到传入新的数组。

`F8` / `Shift` + `F8` 跳到下一个 / 上一个问题并显示说明，读屏会读出行号和内容；`Mod` + `.` 显示光标处问题的修复办法，用上下键选择，`Enter` 执行，`Esc` 关闭。触屏上点一下有问题的文字就会显示说明。

### 补全与提示

扩展的 `completion`、`hover`、`signature` 分别提供补全列表、悬停说明和参数提示：

| 名称                 | 说明                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `completion`         | 输入时调用，参数是 `{ pos, word, explicit, signal }`，返回 `{ from, options }` 或 `null`，可以返回 Promise                    |
| `completionTriggers` | 输入这些字符后也弹出补全，比如 `['.']`                                                                                        |
| `hover`              | 鼠标停在文字上，或按 `Mod` + `I` 时调用，参数是 `{ pos, signal }`，返回 `{ from?, to?, content }` 或 `null`，可以返回 Promise |
| `signature`          | 光标移动或输入 `(`、`,` 时调用，参数是 `{ pos, signal }`，返回 `{ label, params, active, info? }` 或 `null`，可以返回 Promise |

`word` 是光标前的词（`{ from, to, text }`）。`from` 是补全替换的起点，从 `from` 到光标的文字用来筛选和排序 `options`：开头一致的排在前面，其次是按词首字母匹配的，比如 `gebi` 能找到 `getElementById`。继续输入时编辑器直接用已有的结果重新筛选，同时再调用一次 `completion`；新结果回来之前文字又变了，旧的结果会被丢掉，`signal` 也会中止。`hover` 和 `signature` 也一样：鼠标移开或光标移动后，还没回来的结果会被丢掉，`signal` 会中止。

补全项是 `{ label, kind?, detail?, info?, insert?, snippet?, boost? }`。`kind` 决定前面的图标，可以是 `keyword`、`function`、`method`、`variable`、`property`、`constant`、`class`、`type`、`module`、`snippet`、`text`；`detail` 显示在右侧，`info` 显示在列表底部；`insert` 是实际插入的文字，默认等于 `label`；`boost` 用来调整排序。

`snippet` 是带占位的片段：`${1:name}` 是第 1 个占位，里面预先填着 `name`；再次出现的 `$1` 和它同步填写；`$0` 是最后光标停下的地方。片段里的换行会带上当前行的缩进，制表符按编辑器的缩进方式写出。插入后选中第一个占位，`Tab` / `Shift` + `Tab` 在占位之间前后跳转，同号的占位会一起选中、一起修改；到 `$0`，或在没有 `$0` 时从最后一个占位再按 `Tab`（光标停在片段末尾），或按 `Esc` 后结束。在占位里输入时弹出的补全列表不会拦下 `Tab`，`Tab` 仍然跳到下一个占位；用方向键选过列表里的项之后，`Tab` 才插入这一项。

补全列表打开时，`↑` `↓` 选择，`PageUp` / `PageDown` 一次移动多项，`Enter` 或 `Tab` 插入，`Esc` 关闭；`Ctrl` + `Space` 或 `Alt` + `Esc` 主动打开补全（Apple 设备上 `Ctrl` + `Space` 通常用来切换输入法）。列表打开和换选中项时，读屏会读出选中的项。

`hover` 的 `content` 可以是文字，也可以是返回 VNode 的函数；它和这里的问题显示在同一个说明框里，在上面。`signature` 的 `params` 是各个参数在 `label` 里的 `[from, to]`，`active` 是正在填写的参数，会加粗显示。

<DocDemo src="code/completion" column />

### 在 worker 里计算

补全和检查可能很耗时，比如要分析整个文件。这时可以把它们放进 Web Worker，扩展只负责发送请求、返回 Promise：编辑器会等结果回来，文字又变了就丢掉旧结果，`signal` 也会中止，这时可以不再等这次回复。下面的例子把文本和光标位置发给 worker，worker 算出补全项和问题再发回来。worker 每次收到的是整段文本；文件很大时，可以改为只发送改动（`transaction` 事件里的 `changes`），由 worker 维护一份副本。

<DocDemo src="code/worker" column />

## 大文件

编辑器只绘制看得见的行，文本保存在按行组织的平衡树里：按行号或位置查找、插入、删除都只走一条路径，打开文件时也不复制内容。滚动时只绘制新进入视野的行；修改一行只重画这一行。

<DocDemo src="code/large" column />

`v-model` 每次修改都要把整份文本拼成一个字符串。文件很大时，改用 `v-model:doc` 绑定 `CodeText`：它是不可变的，每次修改得到一个新的 `CodeText`，没有改动的部分和旧的共享，不需要拼接。用 `shallowRef` 保存就够了。只关心最终结果时，也可以用 `v-model.lazy`，在编辑器失去焦点时才交回字符串。

```ts
import { CodeText } from '@dou-ui/code'

const doc = shallowRef(CodeText.of(source))
// 需要字符串时再拼：doc.value.toString()
```

编辑器比窗口还高时（没有限制高度），也只绘制窗口里看得见的行。

### 语法高亮

颜色从文本开头往下读出来，每读一行都依赖上一行结束时的状态。编辑器先读看得见的行，其余的在浏览器空闲时接着读，每隔一段记下读到的状态，修改以后从改动的地方重读，遇到和之前相同的状态就停下。跳到还没读到的地方时，这些行先以普通文字显示，读到以后再上色；百万行的文件从头读到尾大约要几秒。

### 在 worker 里分词

加上 `worker`，就由 worker 往下读，页面只读看得见的几行，读好的状态再发回来。编辑器自带的 worker 认识所有内置语言，多个编辑器共用一个，最后一个编辑器卸载时结束：

```vue
<template>
  <DouCodeEditor v-model:doc="doc" :language="javascript" worker />
</template>
```

用自定义语言或者想自己打包 worker 时，`worker` 传一个创建 worker 的函数。编辑器挂载以后才调用它，所以服务端渲染时不会碰到 `Worker`；它创建的 worker 由编辑器结束：编辑器卸载或者换掉 `worker` 时调用 `terminate()`，不用自己关闭。所以函数每次都要新建一个 worker，不要把已经结束的 worker 再交给编辑器；几个编辑器拿到同一个 worker 时，最后一个用它的编辑器卸载时才结束。在 worker 文件里调用 `@dou-ui/code/worker` 的 `serveCodeHighlighting`，列出要支持的语言：

```ts
// highlight.ts
import { javascript, serveCodeHighlighting } from '@dou-ui/code/worker'
import { myLanguage } from './my-language'

serveCodeHighlighting([javascript, myLanguage])
```

```vue
<script setup lang="ts">
const createWorker = () =>
  new Worker(new URL('./highlight.ts', import.meta.url), { type: 'module' })
</script>

<template>
  <DouCodeEditor v-model:doc="doc" :language="myLanguage" :worker="createWorker" />
</template>
```

自带的 worker 打包在组件里，用到时才加载，以 `blob:` 地址启动。站点设置了内容安全策略（CSP）时，需要在 `worker-src` 中允许 `blob:`。如果不能放开，可以像上面这样用函数加载自己的 worker 文件。自带的 worker 无法启动时，编辑器会在控制台给出提示，并改为在页面中读。

`@dou-ui/code/worker` 只包含语言和分词，不会引入 Vue 和组件。包含其他语言的语言要在 `nested` 里列出它们。worker 里没有编辑器用的语言（按名称查找，包括它包含的语言），或者 worker 无法启动时，编辑器改为自己在空闲时读，开发环境下会在控制台说明缺少哪种语言。

### 小地图

`minimap` 在右侧显示整份代码的缩略图，按语法着色，标出看得见的部分：点击跳到那里，拖动标记滚动。编辑器窄于 480px 时不显示。

## 只读与禁用

`readonly` 只能选择、浏览和复制，不能修改；`disabled` 不能获得焦点。`placeholder` 在文本为空时显示提示文字。

## 外观

| 属性               | 默认值  | 说明                     |
| ------------------ | ------- | ------------------------ |
| `line-numbers`     | `true`  | 显示行号                 |
| `active-line`      | `true`  | 给光标所在行加一层浅底色 |
| `tab-size`         | `2`     | 制表位宽度，也是一级缩进 |
| `indent-with-tabs` | `false` | 用制表符缩进，而不是空格 |

字号、行高和颜色用 CSS 变量调整：

| 变量                            | 默认值                        |
| ------------------------------- | ----------------------------- |
| `--dou-code-editor-font-size`   | `var(--dou-font-size-sm)`     |
| `--dou-code-editor-line-height` | `20px`                        |
| `--dou-code-editor-bg`          | `var(--dou-color-bg-surface)` |
| `--dou-code-editor-selection`   | 主色的浅色                    |
| `--dou-code-editor-active-line` | 文字色的 4%                   |
| `--dou-code-editor-padding-y`   | `8px`                         |
| `--dou-code-editor-padding-x`   | `12px`                        |

行高请用整数像素，每一行都按这个高度排列。`padding-y` 是第一行上方和最后一行下方的空白，`padding-x` 是每行左右的空白。

## 对比视图

`DouCodeDiff` 对比两段文本：`original` 是原文，`v-model` 是修改后的文本。删除的行和新增的行用浅色底标出，行内改动的词用深一点的底色标出，行号旁边的 `−` / `+` 不靠颜色也能分辨。

<DocDemo src="code/diff" column />

`mode` 决定怎样显示：`split` 左右并排，`inline` 把删除和新增的行放在同一列里，左侧两列行号分别是原文和修改后的行号。默认的 `auto` 在宽度不少于 560px（两侧各约 30 列）时并排，更窄时（比如手机上）改为行内；工具栏上的按钮可以切换，用 `v-model:mode` 可以记住切换的结果。并排时两侧逐行对齐，一侧多出的行在另一侧用斜纹空行补齐，两侧一起上下、左右滚动；为了保持对齐，并排时不自动换行，`wrap` 只对行内显示生效。

连续多行没有改动时，只保留改动前后各 `context` 行（默认 3 行），其余的收起成一条“N 行未改动”的栏，点一下展开。`collapse-unchanged` 设为 `false` 时全部显示，也可以写成 `{ context, minLines }`：至少能收起 `minLines` 行（默认 4 行）时才收起。工具栏上可以一次展开或收起全部；查找等操作把光标移进收起的行时，这一段会自动展开。

加上 `editable` 后可以在并排视图的右侧直接修改，对比结果随输入更新；行内视图总是只读的。`extensions` 只用在并排视图的右侧。`F7` / `Shift` + `F7` 跳到下一处 / 上一处改动，读屏会读出这是第几处改动和改了几行。

对比按整行进行（Myers 算法，线性空间），行内再按词比较，中文按字比较；改动的词太多时只标整行。`ignore-whitespace` 把只有空白不同的行看作相同。也可以直接调用 `diffText(original, modified, options?)` 得到改动列表，每一项是 `{ originalStart, originalCount, modifiedStart, modifiedCount, parts }`，行号从 1 开始，`parts` 是改动的词在两段文本里的位置。

## 代码输入框

`DouCodeInput` 是和输入框一样高的代码编辑器，用来写表达式、公式这类一两行的代码。它没有行号和折叠，`Tab` 和普通输入框一样移到下一个控件；补全列表、说明和参数提示显示在页面上层，不会被输入框挡住。

默认只有一行：`Enter` 触发 `enter` 事件，粘贴进来的换行会变成空格，内容超出宽度时横向滚动。加上 `multiline` 后可以换行，输入框随内容长高，超过 `autosize.maxRows` 行后滚动（写法和 `DouTextarea` 的 `autosize` 相同），这时 `Mod` + `Enter` 触发 `enter`。

放在 `DouFormItem` 里时，它和 `DouInput` 一样使用表单项的 `id`、说明和校验状态，`size` 和 `disabled` 也跟随表单。

<DocDemo src="code/input" column />

## 在其他组件里使用

几个生态包提供了用代码编辑器编辑的版本，都放在各自的 `code` 子路径下，需要时再安装 `@dou-ui/code`：

| 用在哪里   | 引入                                               | 说明                                                                                                             |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 块编辑器   | `codeEditorBlock` from `@dou-ui/editor/code`       | 文档里的代码块直接用代码编辑器编辑，见[代码块](/editor/code-block#用代码编辑器编辑)                              |
| 电子表格   | `DouSheetCodeFormulaBar` from `@dou-ui/sheet/code` | 编辑栏里的公式着色、括号匹配、标出写错的地方，见[编辑栏](/sheet/formulas#代码版编辑栏)                           |
| 表单设计器 | `codeExpressions` from `@dou-ui/form-builder/code` | 表达式写在代码输入框里，带字段名补全和诊断，见[用代码输入框写表达式](/form-builder/builder#用代码输入框写表达式) |

区块里的[代码练习](/blocks/code-practice)和[配置编辑](/blocks/config-editor)是两个完整的页面示例。

## API

### Props

| 名称                | 说明                                                              | 类型                               | 默认值     |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------- | ---------- |
| `v-model`           | 代码                                                              | `string`                           | —          |
| `v-model:doc`       | 代码，作为 `CodeText`，大文件用                                   | `CodeText`                         | —          |
| `v-model:selection` | 选区                                                              | `CodeSelection`                    | 开头的光标 |
| `readonly`          | 只读                                                              | `boolean`                          | `false`    |
| `disabled`          | 禁用                                                              | `boolean`                          | `false`    |
| `line-numbers`      | 显示行号                                                          | `boolean`                          | `true`     |
| `active-line`       | 给光标所在行加底色                                                | `boolean`                          | `true`     |
| `tab-size`          | 制表位宽度                                                        | `number`                           | `2`        |
| `indent-with-tabs`  | 用制表符缩进                                                      | `boolean`                          | `false`    |
| `placeholder`       | 文本为空时的提示                                                  | `string`                           | —          |
| `language`          | 语言                                                              | `CodeLanguage`                     | —          |
| `worker`            | 在 worker 里分词：`true` 用自带的 worker，函数创建自己的 worker   | `boolean \| (() => Worker)`        | `false`    |
| `close-brackets`    | 输入括号和引号时补上另一半                                        | `boolean`                          | `true`     |
| `match-brackets`    | 标出光标旁的括号和它的配对                                        | `boolean`                          | `true`     |
| `searchable`        | 提供查找替换面板                                                  | `boolean`                          | `true`     |
| `wrap`              | 长行自动换行                                                      | `boolean`                          | `false`    |
| `minimap`           | 在右侧显示小地图，编辑器窄于 480px 时不显示                       | `boolean`                          | `false`    |
| `foldable`          | 显示折叠箭头，允许折叠                                            | `boolean`                          | `true`     |
| `keys`              | 触屏上键盘上方的符号栏；数组改写可以滑动的按键                    | `boolean \| (CodeKey \| string)[]` | `true`     |
| `messages`          | 改写编辑器上的文字（查找面板、工具条、符号栏）                    | `Partial<CodeMessages>`            | —          |
| `keymap`            | 额外的按键，比内置的优先                                          | `CodeKeymap`                       | —          |
| `extensions`        | 扩展                                                              | `CodeExtension[]`                  | —          |
| `diagnostics`       | 要显示的问题，之后跟着修改移动                                    | `CodeDiagnostic[]`                 | —          |
| `tab-indents`       | `Tab` 用来缩进；关闭后 `Tab` 移到下一个控件，补全和片段里仍然可用 | `boolean`                          | `true`     |
| `teleport`          | 补全列表、说明和参数提示渲染到哪里；`false` 时在编辑器的边框内    | `string \| HTMLElement \| false`   | `false`    |
| `autofocus`         | 挂载后获得焦点                                                    | `boolean`                          | `false`    |
| `aria-label`        | 读屏读出的名称                                                    | `string`                           | —          |

### Events

| 名称          | 说明                                   | 参数                                    |
| ------------- | -------------------------------------- | --------------------------------------- |
| `transaction` | 每次修改之后，包括撤销和外部的新值     | `CodeTransactionResult`                 |
| `focus`       | 获得焦点                               | `FocusEvent`                            |
| `blur`        | 失去焦点                               | `FocusEvent`                            |
| `fold-change` | 折叠状态变化，包括修改让折叠的段换了行 | `number[]`（各段的起始行号，从 1 开始） |

### 实例

| 名称                           | 说明                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `state`、`doc`、`selection`    | 现在的文本与选区                                                              |
| `transact(run, meta?)`         | 做一次修改，返回结果；没有变化时返回 `null`                                   |
| `run(command)`                 | 执行一个命令                                                                  |
| `undo()`、`redo()`             | 撤销、重做，返回是否执行了                                                    |
| `canUndo`、`canRedo`           | 能否撤销、重做                                                                |
| `select(anchor, head?)`        | 选中一段（不传 `head` 时是光标），或传入整个选区，并滚动到可见                |
| `scrollIntoView(pos?)`         | 把某个位置（默认主光标）滚动到可见                                            |
| `coordsAtPos(pos)`             | 某个位置在视口中的坐标；所在行没有绘制时为 `null`                             |
| `posAtCoords({ x, y })`        | 视口中某一点最近的文本位置                                                    |
| `focus()`、`blur()`            | 获得、失去焦点                                                                |
| `openSearch(query?)`           | 打开查找面板，`query` 设置查找的内容与选项；`searchable` 关闭时返回 `false`   |
| `closeSearch()`                | 关闭查找面板；没有打开时返回 `false`                                          |
| `fold(line?)`、`unfold(line?)` | 折叠、展开某一行（从 1 开始）开始的一段，不传时用光标所在的行；返回有没有变化 |
| `foldAll()`、`unfoldAll()`     | 折叠所有最外层的段、全部展开；返回有没有变化                                  |
| `folds`                        | 现在折叠着的各段的起始行号                                                    |
| `diagnostics`                  | 现在的所有问题，按位置排序                                                    |

### DouCodeKeys Props

| 名称       | 说明                                                               | 类型                    | 默认值 |
| ---------- | ------------------------------------------------------------------ | ----------------------- | ------ |
| `editor`   | 按键输入到的编辑器（实例）                                         | `CodeEditorExpose`      | —      |
| `keys`     | 可以滑动的按键，默认是 `defaultCodeKeys`；末尾的四个方向键一直都在 | `(CodeKey \| string)[]` | —      |
| `messages` | 改写按键的名称                                                     | `Partial<CodeMessages>` | —      |

`CodeKey` 的字段见上文“手机触控”一节。

### DouCodeDiff Props

| 名称                   | 说明                                                      | 类型                                                 | 默认值   |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------- | -------- |
| `original`             | 原文                                                      | `string`                                             | `''`     |
| `v-model`              | 修改后的文本                                              | `string`                                             | `''`     |
| `v-model:mode`         | 显示方式                                                  | `'split' \| 'inline' \| 'auto'`                      | `'auto'` |
| `language`             | 语言，两侧相同                                            | `CodeLanguage`                                       | —        |
| `readonly`             | 不能修改右侧                                              | `boolean`                                            | `true`   |
| `collapse-unchanged`   | 收起没有改动的行                                          | `boolean \| { context?: number, minLines?: number }` | `true`   |
| `ignore-whitespace`    | 只有空白不同的行看作相同                                  | `boolean`                                            | `false`  |
| `words`                | 标出行内改动的词                                          | `boolean`                                            | `true`   |
| `wrap`                 | 行内显示时自动换行                                        | `boolean`                                            | `false`  |
| `extensions`           | 右侧编辑器的扩展，只在并排时使用                          | `CodeExtension[]`                                    | —        |
| `toolbar`              | 显示工具栏：改动统计、上一处 / 下一处、展开全部、切换显示 | `boolean`                                            | `true`   |
| `tab-size`、`messages` | 和编辑器相同                                              | —                                                    | —        |

实例上有 `hunks`（现在的改动列表）、`next()`、`previous()`、`expandAll()`、`collapseAll()`，以及 `original`、`modified` 两个编辑器实例（行内显示时只有 `modified`，是那一列的编辑器）。

### DouCodeInput Props

| 名称                                                                                        | 说明                                                     | 类型                                     | 默认值                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| `v-model`                                                                                   | 代码；只有一行时，换行会变成空格                         | `string`                                 | —                            |
| `multiline`                                                                                 | 允许多行，随内容长高                                     | `boolean`                                | `false`                      |
| `autosize`                                                                                  | 多行时最少、最多显示的行数，超过后滚动                   | `{ minRows?: number, maxRows?: number }` | `{ minRows: 1, maxRows: 6 }` |
| `size`                                                                                      | 尺寸，和输入框一致                                       | `'sm' \| 'md' \| 'lg'`                   | 跟随表单，否则 `'md'`        |
| `invalid`                                                                                   | 显示为有错误                                             | `boolean`                                | `false`                      |
| `disabled`、`readonly`                                                                      | 禁用、只读                                               | `boolean`                                | `false`                      |
| `placeholder`                                                                               | 为空时的提示                                             | `string`                                 | —                            |
| `language`、`extensions`、`diagnostics`、`keymap`、`close-brackets`、`tab-size`、`messages` | 和编辑器相同                                             | —                                        | —                            |
| `teleport`                                                                                  | 补全列表、说明和参数提示渲染到哪里；`false` 时在输入框内 | `string \| HTMLElement \| false`         | 全局配置，否则 `body`        |
| `keys`                                                                                      | 触屏上键盘上方的符号栏                                   | `boolean \| (CodeKey \| string)[]`       | `false`                      |
| `aria-label`                                                                                | 读屏读出的名称                                           | `string`                                 | —                            |

事件有 `update:modelValue`、`enter`、`transaction`、`focus`、`blur`；实例和 `DouCodeEditor` 相同。
