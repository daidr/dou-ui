# 代码编辑器

`@dou-ui/code` 提供代码编辑器 `DouCodeEditor`：一块等宽字体、带行号的可编辑文本区域。十万行的文件也能马上打开、流畅输入和滚动，中文输入法在光标处直接组字，可以同时有多个选区。适合做配置编辑、脚本输入、代码练习这类"编辑一段代码"的界面。

只是展示一段代码时，用 [CodeBlock 代码块](/components/code-block) 更合适。

::: tip 开发中
目前完成的是编辑内核：输入、选择、撤销和大文件。语法高亮、括号与缩进、查找替换、折叠、补全和协同编辑会陆续加入。
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

## 选择与光标

点击放下光标，拖动选择，双击选中一个词，三击选中一行；按住 `Shift` 点击扩大选区。点击行号选中整行，在行号上拖动选中多行。拖到编辑器边缘时会自动滚动。

`v-model:selection` 读写选区：`ranges` 是选中的范围，每个范围的 `anchor` 是起点，`head` 是光标所在的一端，两者相等就是一个光标；`main` 是主选区的序号。位置是从文本开头数起的偏移，按 UTF-16 计数，和浏览器、语言服务的约定一致。

<DocDemo src="code/selection" column />

按住 `Alt`（Apple 上是 `⌥`）点击，在点击处加一个光标；按住拖动则加一个选区。有多个选区时，输入、删除、粘贴会作用到每一个上；粘贴的行数和选区个数相同时，每个选区各得一行。按 `Esc` 只留下主选区。也可以用 `v-model:selection` 或 `select()` 从代码里设置多个选区。

双击选中一个词，三击或点击行号选中一整行；双击、三击后继续拖动，会按词或按行扩大选区。

光标按用户看到的字符移动：一个 emoji 或带声调的字母是一个字符，不会停在中间。按词移动时，中文按浏览器的分词结果切分，而不是把一整段中文当成一个词。

## 输入法

焦点在一个看不见的输入框上，它跟着光标走，所以输入法的候选框出现在光标处。组字时，拼音直接显示在光标位置并带下划线，确认后才写入文本；组字期间按下的 `Enter`、方向键等都交给输入法，不会触发编辑器的快捷键，确认候选词的 `Enter` 也不会多换一行。

手机上轻点放下光标并弹出键盘，单指滑动是滚动；按住片刻选中一个词。键盘的空格键拖动光标、自动更正和语音输入都能正常使用。输入框的字号至少是 16px，避免手机在聚焦时自动放大页面。

## 键盘操作

`Mod` 在 Apple 设备上是 `⌘`，在其他系统上是 `Ctrl`。

| 按键                                               | 作用                                              |
| -------------------------------------------------- | ------------------------------------------------- |
| 方向键                                             | 移动一个字符或一行，上下移动时保持列的位置        |
| `Alt` / `Ctrl` + `←` `→`                           | 按词移动（Apple 设备上用 `⌥`，其他用 `Ctrl`）     |
| `Home` / `End`，Apple 上也可 `⌘` + `←` `→`         | 移到行首或行尾；行首先停在缩进之后                |
| `Mod` + `Home` / `End`，Apple 上 `⌘` + `↑` `↓`     | 移到文本开头或结尾                                |
| `PageUp` / `PageDown`                              | 翻一屏                                            |
| 以上按键加 `Shift`                                 | 扩大选区                                          |
| `Backspace` / `Delete`                             | 删除一个字符；有选区时删除选区                    |
| `Alt` / `Ctrl` + `Backspace`                       | 删除一个词；Apple 上 `⌘` + `Backspace` 删到行首   |
| `Enter`                                            | 换行，并保留当前行的缩进                          |
| `Tab` / `Shift` + `Tab`                            | 缩进到下一个制表位 / 减少缩进；选中多行时整体缩进 |
| `Mod` + `]` / `[`                                  | 增加 / 减少所在行的缩进                           |
| `Mod` + `A`                                        | 全选                                              |
| `Mod` + `Z`，`Mod` + `Shift` + `Z` 或 `Ctrl` + `Y` | 撤销，重做                                        |
| `Esc`                                              | 只留下主选区；之后按 `Tab` 会离开编辑器           |

编辑器里 `Tab` 用来缩进。只用键盘时，先按 `Esc` 再按 `Tab`，焦点就会移到页面上的下一个元素。

`keymap` 属性添加或覆盖按键，见[用代码修改](#用代码修改)。

## 撤销与重做

连续输入或连续删除会合成一步撤销，停顿超过半秒、移动过光标或换了一种操作就开始新的一步。撤销后选区回到修改前的位置。通过组件实例调用 `undo()`、`redo()`，用 `canUndo`、`canRedo` 控制按钮状态。

`v-model` 在外面被改成新的字符串时，编辑器只算出改动的那一段，作为一次修改应用：光标留在原来的内容上，这次修改也能撤销。

## 用代码修改

组件实例的 `transact(run)` 做一次修改：在 `run` 里调用 `tr.replace(from, to, text)`、`tr.insert(pos, text)`、`tr.delete(from, to)` 或 `tr.replaceSelection(text)`，整次修改算一步撤销。同一次修改里的所有位置都按修改**之前**的文本计算，后面的调用不用考虑前面插入或删除带来的偏移；各处修改不能重叠。没有调用 `tr.select()` 时，选区随修改移动。

<DocDemo src="code/transact" column />

示例里"用 log() 包起选区"把每个选区换成 `log(选中的文字)`，光标处没有选中文字时插入一个空的 `log()`；"在每行前加 //"在每个非空行的开头插入 `// `，这些插入用的都是修改前的位置。

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

内置命令及默认按键（`Mod` 的含义同上，"Apple" 一列只写和其他系统不同的按键）：

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

| 名称                | 说明                            | 类型               | 默认值     |
| ------------------- | ------------------------------- | ------------------ | ---------- |
| `v-model`           | 代码                            | `string`           | —          |
| `v-model:doc`       | 代码，作为 `CodeText`，大文件用 | `CodeText`         | —          |
| `v-model:selection` | 选区                            | `CodeSelection`    | 开头的光标 |
| `readonly`          | 只读                            | `boolean`          | `false`    |
| `disabled`          | 禁用                            | `boolean`          | `false`    |
| `line-numbers`      | 显示行号                        | `boolean`          | `true`     |
| `active-line`       | 给光标所在行加底色              | `boolean`          | `true`     |
| `tab-size`          | 制表位宽度                      | `number`           | `2`        |
| `indent-with-tabs`  | 用制表符缩进                    | `boolean`          | `false`    |
| `placeholder`       | 文本为空时的提示                | `string`           | —          |
| `keymap`            | 额外的按键，比内置的优先        | `CodeKeyBinding[]` | —          |
| `autofocus`         | 挂载后获得焦点                  | `boolean`          | `false`    |
| `aria-label`        | 读屏读出的名称                  | `string`           | —          |

### Events

| 名称          | 说明                               | 参数                    |
| ------------- | ---------------------------------- | ----------------------- |
| `transaction` | 每次修改之后，包括撤销和外部的新值 | `CodeTransactionResult` |
| `focus`       | 获得焦点                           | `FocusEvent`            |
| `blur`        | 失去焦点                           | `FocusEvent`            |

### 实例

| 名称                        | 说明                                                           |
| --------------------------- | -------------------------------------------------------------- |
| `state`、`doc`、`selection` | 现在的文本与选区                                               |
| `transact(run, meta?)`      | 做一次修改，返回结果；没有变化时返回 `null`                    |
| `run(command)`              | 执行一个命令                                                   |
| `undo()`、`redo()`          | 撤销、重做，返回是否执行了                                     |
| `canUndo`、`canRedo`        | 能否撤销、重做                                                 |
| `select(anchor, head?)`     | 选中一段（不传 `head` 时是光标），或传入整个选区，并滚动到可见 |
| `scrollIntoView(pos?)`      | 把某个位置（默认主光标）滚动到可见                             |
| `coordsAtPos(pos)`          | 某个位置在视口中的坐标；所在行没有绘制时为 `null`              |
| `posAtCoords({ x, y })`     | 视口中某一点最近的文本位置                                     |
| `focus()`、`blur()`         | 获得、失去焦点                                                 |
