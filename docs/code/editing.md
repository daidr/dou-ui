# 编辑操作

本页介绍选区、多光标、查找替换、折叠等编辑操作，以及全部快捷键。`Mod` 在 Apple 设备上是 `⌘`，在其他系统上是 `Ctrl`。

## 选区

使用 `v-model:selection` 读写选区。

<DocDemo src="code/selection" column />

选区的格式是 `{ ranges, main }`：

- `ranges` 是选中的范围。每个范围的 `anchor` 是起点，`head` 是光标所在的一端，两者相等时就是一个光标。
- `main` 是主选区在 `ranges` 中的序号。
- 位置是从文本开头数起的偏移，按 UTF-16 计数。

用鼠标时，点击放置光标，拖动选择，双击选中一个词，三击或点击行号选中一行，按住 `Shift` 点击扩大选区。

## 多光标

有多个选区时，输入、删除和粘贴会作用到每一个选区上。粘贴的行数和选区个数相同时，每个选区各得一行。按 `Esc` 只保留主选区。

| 操作                                               | 作用                                       |
| -------------------------------------------------- | ------------------------------------------ |
| `Alt` + 点击（Apple 上是 `⌥`）                     | 在点击处添加一个光标，拖动则添加一个选区   |
| `Alt` + `Shift` + 拖动                             | 按列选择一个矩形区域                       |
| `Mod` + `D`                                        | 选中光标处的词，再按一次加选下一个相同的词 |
| `Mod` + `Shift` + `L`                              | 选中所有相同的词                           |
| `Ctrl` + `Alt` + `↑` / `↓`（Apple 上是 `⌥` + `⌘`） | 在上一行或下一行添加一个光标               |

也可以用 `v-model:selection` 或 `select()` 设置多个选区。

## 查找与替换

按 `Mod` + `F` 打开查找面板，按 `Mod` + `H`（Apple 上是 `⌥` + `⌘` + `F`）打开替换。

<DocDemo src="code/search" column />

- `Enter` 和 `Shift` + `Enter` 跳到下一个和上一个匹配，`Esc` 关闭面板。
- 查找框右侧的开关分别是区分大小写、全词匹配和正则表达式。
- 替换框中按 `Enter` 替换当前匹配，按 `Mod` + `Enter` 全部替换。全部替换算作一次修改，撤销一次即可还原。
- 使用正则表达式时，替换文字可以用 `$1`、`$<name>` 引用分组，`$&` 表示整个匹配，`$$` 表示 `$`。
- 只读的编辑器只能查找。

用代码打开面板时调用 `openSearch(query?)`，`query` 可以带上查找内容和选项，带上 `replace` 时同时展开替换框。触屏设备上没有这些按键，需要时自己放一个按钮调用 `openSearch()`。

`searchable` 设为 `false` 时不提供查找面板，`Mod` + `F` 交还给浏览器，`openSearch()` 返回 `false`。

查找面板是 [FindReplace](/components/find-replace) 组件，面板上的文字在 [ConfigProvider](/components/config-provider) 语言包的 `findReplace` 中。

### 在编辑器之外查找

`searchText` 和 `replacementFor` 可以单独使用：

```ts
import { CodeText, replacementFor, searchText } from '@dou-ui/code'

const doc = CodeText.of('let a = 1\nlet b = 2')
const query = { search: 'let (\\w)', regexp: true, replace: 'const $1' }
const { matches } = searchText(doc, query) // [{ from: 0, to: 5 }, { from: 10, to: 15 }]
replacementFor(doc, matches[0], query) // 'const a'
```

一次最多统计 10000 个匹配，全部替换不受这个限制。

## 自动换行与折叠

`wrap` 让长行在编辑器宽度处换行。换出的行与原来那一行的缩进对齐。

<DocDemo src="code/wrap-fold" column />

点击行号旁的箭头折叠一段代码。设置了 `language` 时，以左括号结尾的行折叠到对应的右括号之前；其他行折叠下方缩进更深的行。光标移入折叠的部分时会自动展开。

- `fold(line?)`、`unfold(line?)`、`foldAll()`、`unfoldAll()` 用代码折叠和展开，`line` 是从 1 开始的行号。
- `folds` 是当前折叠的各段的起始行号。折叠变化时触发 `foldChange` 事件，参数相同；保存下来，之后逐个传给 `fold(line)` 即可恢复。
- `foldable` 设为 `false` 时不能折叠。

## 撤销与重做

连续的输入或删除合并为一步撤销。停顿超过半秒、移动光标或换一种操作时，开始新的一步。撤销后选区回到修改前的位置。

用代码撤销时调用 `undo()`、`redo()`，并用 `canUndo`、`canRedo` 控制按钮的状态。`v-model` 被外部改为新的字符串时，这次修改同样可以撤销。

## 输入法

使用输入法时，候选框出现在光标处，正在组字的拼音显示在光标位置并带下划线。组字期间按下的 `Enter`、方向键等交给输入法处理，不会触发编辑器的快捷键。

## 快捷键

| 作用                      | 按键                                              | Apple 上不同的按键                                  |
| ------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| 按词移动                  | `Ctrl` + `←` / `→`                                | `⌥` + `←` / `→`                                     |
| 移到行首 / 行尾           | `Home` / `End`（行首先停在缩进之后）              | 另有 `⌘` + `←` / `→`                                |
| 移到文本开头 / 结尾       | `Ctrl` + `Home` / `End`                           | `⌘` + `↑` / `↓`                                     |
| 翻一屏                    | `PageUp` / `PageDown`                             |                                                     |
| 扩大选区                  | 以上移动按键加 `Shift`                            |                                                     |
| 全选                      | `Mod` + `A`                                       |                                                     |
| 删除前 / 后一个词         | `Ctrl` + `Backspace` / `Delete`                   | `⌥` + `Backspace` / `Delete`                        |
| 删到行首 / 行尾           |                                                   | `⌘` + `Backspace` / `Delete`，`Ctrl` + `K` 删到行尾 |
| 缩进 / 减少缩进           | `Tab` / `Shift` + `Tab`，`Mod` + `]` / `[`        |                                                     |
| 撤销 / 重做               | `Mod` + `Z` / `Mod` + `Shift` + `Z`、`Ctrl` + `Y` |                                                     |
| 注释或取消注释            | `Mod` + `/`                                       |                                                     |
| 上移 / 下移所在行         | `Alt` + `↑` / `↓`                                 | `⌥` + `↑` / `↓`                                     |
| 向上 / 向下复制所在行     | `Shift` + `Alt` + `↑` / `↓`                       | `Shift` + `⌥` + `↑` / `↓`                           |
| 删除所在行                | `Mod` + `Shift` + `K`                             |                                                     |
| 移到配对的括号            | `Mod` + `Shift` + `\`                             |                                                     |
| 选中下一个 / 所有相同的词 | `Mod` + `D` / `Mod` + `Shift` + `L`               |                                                     |
| 在上一行 / 下一行添加光标 | `Ctrl` + `Alt` + `↑` / `↓`                        | `⌥` + `⌘` + `↑` / `↓`                               |
| 只保留主选区              | `Esc`                                             |                                                     |
| 打开查找 / 替换           | `Mod` + `F` / `Mod` + `H`                         | `⌘` + `F` / `⌥` + `⌘` + `F`                         |
| 下一个 / 上一个匹配       | `F3`、`Mod` + `G`，加 `Shift` 反向                |                                                     |
| 折叠 / 展开               | `Ctrl` + `Shift` + `[` / `]`                      | `⌥` + `⌘` + `[` / `]`                               |
| 打开补全                  | `Ctrl` + `Space` 或 `Alt` + `Esc`                 |                                                     |
| 显示光标处的说明          | `Mod` + `I`                                       |                                                     |
| 下一个 / 上一个问题       | `F8` / `Shift` + `F8`                             |                                                     |
| 显示修复办法              | `Mod` + `.`                                       |                                                     |

编辑器中 `Tab` 用于缩进。只用键盘时，先按 `Esc` 再按 `Tab`，焦点会移到页面上的下一个元素。不需要用 `Tab` 缩进时，把 `tabIndents` 设为 `false`。

每个快捷键对应 `codeCommands` 中的一个命令，可以用 `keymap` 修改，见[用代码修改](./transactions#命令)。
