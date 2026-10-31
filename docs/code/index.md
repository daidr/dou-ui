# 代码编辑器

`@dou-ui/code` 提供代码编辑器 `DouCodeEditor`：一块等宽字体、带行号的可编辑文本区域。它按语言给代码着色，自动缩进、补全括号、切换注释；十万行的文件也能马上打开、流畅输入和滚动，中文输入法在光标处直接组字，可以同时有多个选区。适合做配置编辑、脚本输入、代码练习这类"编辑一段代码"的界面。

只是展示一段代码时，用 [CodeBlock 代码块](/components/code-block) 更合适。

::: tip 开发中
目前完成的是编辑内核、语法高亮、多光标、查找替换、自动换行、折叠和手机触控。补全、对比和协同编辑会陆续加入。
:::

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

| 导出         | 语言                                                  | 名称与别名（`lang` 可以写的值）  |
| ------------ | ----------------------------------------------------- | -------------------------------- |
| `javascript` | JavaScript                                            | `javascript`、`js`、`mjs`、`cjs` |
| `typescript` | TypeScript                                            | `typescript`、`ts`、`mts`、`cts` |
| `jsx`、`tsx` | 带 JSX 的 JavaScript、TypeScript                      | `jsx`、`tsx`                     |
| `json`       | JSON，也允许注释和末尾逗号                            | `json`、`jsonc`、`json5`         |
| `css`        | CSS                                                   | `css`                            |
| `scss`       | SCSS 和 Less：嵌套规则、`//` 注释与 `$` 变量          | `scss`、`less`、`postcss`        |
| `html`       | HTML，`<script>` 和 `<style>` 里按 JavaScript、CSS 读 | `html`、`htm`、`xml`、`svg`      |
| `vue`        | Vue 单文件组件，模板里的 `{{ }}` 和指令值按表达式读   | `vue`                            |
| `markdown`   | Markdown                                              | `markdown`、`md`                 |

<DocDemo src="code/languages" column />

`<script lang="ts">` 按 TypeScript 读，`<style lang="scss">` 按 SCSS 读。Markdown 的代码块默认只显示成一种颜色；要按语言着色，用 `createMarkdown` 的 `languages` 传入会用到的语言，按代码块开头写的语言名或别名选用：

```ts
import { createMarkdown, typescript, json } from '@dou-ui/code'

const markdown = createMarkdown({ languages: [typescript, json] })
```

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

| 选项          | 说明                                                            |
| ------------- | --------------------------------------------------------------- |
| `name`        | 名称，`createCodeHighlighter` 按它和 `aliases` 匹配 `lang`      |
| `aliases`     | 别名，如 `['js', 'mjs']`                                        |
| `startState`  | 文本开头的状态                                                  |
| `comment`     | 注释写法：`{ line: '//', block: ['/*', '*/'] }`                 |
| `brackets`    | 成对的括号，默认 `'()[]{}'`                                     |
| `autoClose`   | 输入时自动补上另一半的字符，写成一个字符串，默认是左括号和 `'"` |
| `indentAfter` | 光标前的文字符合这个正则时，换行多缩进一级                      |

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

`openSearch(query?)` 用代码打开面板，并可以带上查找的内容与选项，带上 `replace` 时同时展开替换框；`closeSearch()` 关闭面板。`searchable` 设为 `false` 不提供查找面板，`Mod` + `F` 交还给浏览器。面板上的文字跟随 ConfigProvider 的语言包，`messages` 属性可以单独改写其中几条。

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

编辑器里 `Tab` 用来缩进。只用键盘时，先按 `Esc` 再按 `Tab`，焦点就会移到页面上的下一个元素。

`keymap` 属性添加或覆盖按键，见[用代码修改](#用代码修改)。

## 撤销与重做

连续输入或连续删除会合成一步撤销，停顿超过半秒、移动过光标或换了一种操作就开始新的一步。撤销后选区回到修改前的位置。通过组件实例调用 `undo()`、`redo()`，用 `canUndo`、`canRedo` 控制按钮状态。

`v-model` 在外面被改成新的字符串时，编辑器只算出改动的那一段，作为一次修改应用：光标留在原来的内容上，这次修改也能撤销。

## 用代码修改

组件实例的 `transact(run)` 做一次修改：在 `run` 里调用 `tr.replace(from, to, text)`、`tr.insert(pos, text)`、`tr.delete(from, to)` 或 `tr.replaceSelection(text)`，整次修改算一步撤销。同一次修改里的所有位置都按修改**之前**的文本计算，后面的调用不用考虑前面插入或删除带来的偏移；各处修改不能重叠。没有调用 `tr.select()` 时，选区随修改移动。

<DocDemo src="code/transact" column />

示例里“用 log() 包起选区”把每个选区换成 `log(选中的文字)`，光标处没有选中文字时插入一个空的 `log()`；“在每行前加 //”在每个非空行的开头插入 `// `，这些插入用的都是修改前的位置。

`tr.doc` 是修改前的文本（`CodeText`）：`lines` 是行数，`line(n)` 取第 n 行（从 1 开始），`lineAt(pos)` 取某个位置所在的行，`slice(from, to)` 取一段文字。

每次修改之后触发 `transaction` 事件，参数里有 `changes`（这次的改动）、`before` 和 `state`（修改前后的文本与选区），`meta.action` 说明修改的来源：`input` 输入、`delete` 删除、`paste` 粘贴、`cut` 剪切、`undo` / `redo`、`external` 来自新的 `v-model` 值等。

`codeCommands` 里是内置的编辑和移动命令，用 `run(command)` 执行。在按钮里执行命令后，焦点还在按钮上，需要接着输入时再调用 `focus()`。`keymap` 属性传入额外的按键，写法和 `useHotkey` 一样（`mod+shift+k`），比内置按键优先；命令返回 `false` 时继续尝试下一个绑定：

```ts
import { codeCommands, type CodeKeyBinding } from '@dou-ui/code'

const keymap: CodeKeyBinding[] = [
  { key: 'mod+s', run: () => (save(), true) },
  { key: 'mod+d', run: codeCommands.selectAll },
]
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

自定义按键时，`command` 可以是任意命令，比如 `codeCommands.typeText('=>')` 输入一段文字，`codeCommands.toggleComment` 切换注释：

```ts
import { codeCommands } from '@dou-ui/code'

const keys = [
  { label: 'Tab', command: codeCommands.insertTab },
  '(',
  ')',
  { label: '=>', command: codeCommands.typeText(' => ') },
  { label: '//', command: codeCommands.toggleComment, ariaLabel: '切换注释' },
]
```

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

行高请用整数像素，每一行都按这个高度排列。

## API

### Props

| 名称                | 说明                                           | 类型                               | 默认值     |
| ------------------- | ---------------------------------------------- | ---------------------------------- | ---------- |
| `v-model`           | 代码                                           | `string`                           | —          |
| `v-model:doc`       | 代码，作为 `CodeText`，大文件用                | `CodeText`                         | —          |
| `v-model:selection` | 选区                                           | `CodeSelection`                    | 开头的光标 |
| `readonly`          | 只读                                           | `boolean`                          | `false`    |
| `disabled`          | 禁用                                           | `boolean`                          | `false`    |
| `line-numbers`      | 显示行号                                       | `boolean`                          | `true`     |
| `active-line`       | 给光标所在行加底色                             | `boolean`                          | `true`     |
| `tab-size`          | 制表位宽度                                     | `number`                           | `2`        |
| `indent-with-tabs`  | 用制表符缩进                                   | `boolean`                          | `false`    |
| `placeholder`       | 文本为空时的提示                               | `string`                           | —          |
| `language`          | 语言                                           | `CodeLanguage`                     | —          |
| `close-brackets`    | 输入括号和引号时补上另一半                     | `boolean`                          | `true`     |
| `match-brackets`    | 标出光标旁的括号和它的配对                     | `boolean`                          | `true`     |
| `searchable`        | 提供查找替换面板                               | `boolean`                          | `true`     |
| `wrap`              | 长行自动换行                                   | `boolean`                          | `false`    |
| `foldable`          | 显示折叠箭头，允许折叠                         | `boolean`                          | `true`     |
| `keys`              | 触屏上键盘上方的符号栏；数组改写可以滑动的按键 | `boolean \| (CodeKey \| string)[]` | `true`     |
| `messages`          | 改写编辑器上的文字（查找面板、工具条、符号栏） | `Partial<CodeMessages>`            | —          |
| `keymap`            | 额外的按键，比内置的优先                       | `CodeKeyBinding[]`                 | —          |
| `autofocus`         | 挂载后获得焦点                                 | `boolean`                          | `false`    |
| `aria-label`        | 读屏读出的名称                                 | `string`                           | —          |

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
| `openSearch(query?)`           | 打开查找面板，`query` 设置查找的内容与选项                                    |
| `closeSearch()`                | 关闭查找面板                                                                  |
| `fold(line?)`、`unfold(line?)` | 折叠、展开某一行（从 1 开始）开始的一段，不传时用光标所在的行；返回有没有变化 |
| `foldAll()`、`unfoldAll()`     | 折叠所有最外层的段、全部展开；返回有没有变化                                  |
| `folds`                        | 现在折叠着的各段的起始行号                                                    |

### DouCodeKeys Props

| 名称       | 说明                                     | 类型                    | 默认值 |
| ---------- | ---------------------------------------- | ----------------------- | ------ |
| `editor`   | 按键输入到的编辑器（实例）               | `CodeEditorExpose`      | —      |
| `keys`     | 可以滑动的按键；末尾的四个方向键一直都在 | `(CodeKey \| string)[]` | —      |
| `messages` | 改写按键的名称                           | `Partial<CodeMessages>` | —      |

`CodeKey` 的字段：`label` 按键上显示的文字，有图标时是它的名称；`text` 按下时输入的文字，默认是 `label`；`command` 按下时执行的命令，代替输入；`icon` 代替文字显示的图标；`repeat` 按住时连续触发；`ariaLabel` 读屏读出的名称。
