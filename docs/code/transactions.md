# 用代码修改

通过组件实例的 `transact` 修改文本和选区，通过 `run` 执行内置命令。

## 修改文本

`transact(run)` 做一次修改，整次修改算作一步撤销。在 `run` 中调用 `tr` 的方法描述要做的改动：

<DocDemo src="code/transact" column />

```ts
// 在每个非空行前加上 `// `
editor.value.transact((tr) => {
  for (let n = 1; n <= tr.doc.lines; n++) {
    const line = tr.doc.line(n)
    if (line.text) tr.insert(line.from, '// ')
  }
})
```

- 同一次修改中的所有位置都按修改**之前**的文本计算，不需要考虑前面的插入或删除带来的偏移。各处修改不能重叠。
- 没有调用 `tr.select()` 时，选区跟随修改移动。
- `transact` 返回这次修改的结果；没有任何变化时返回 `null`。

## 读取文本

`tr.doc` 和实例的 `doc` 都是 `CodeText`：

| 名称              | 说明               |
| ----------------- | ------------------ |
| `length`          | 字符数             |
| `lines`           | 行数               |
| `line(n)`         | 第 n 行，从 1 开始 |
| `lineAt(pos)`     | 某个位置所在的行   |
| `slice(from, to)` | 取一段文字         |
| `toString()`      | 整段文本           |

`CodeText.of(text)` 从字符串或行数组创建 `CodeText`。

## 监听修改

文字或选区变化后触发 `transaction` 事件。只移动光标或改变选区时也会触发，这时 `changes.empty` 为 `true`；判断文字是否改变，请使用 `!result.changes.empty`：

```ts
function onTransaction(result: CodeTransactionResult) {
  if (!result.changes.empty) dirty.value = true
}
```

参数中的 `meta.action` 说明变化的来源，可能没有值（例如调用 `select()` 时）：

| `meta.action`  | 来源                   |
| -------------- | ---------------------- |
| `input`        | 输入                   |
| `delete`       | 删除                   |
| `paste`、`cut` | 粘贴、剪切             |
| `drop`         | 拖放                   |
| `indent`       | 缩进                   |
| `select`       | 改变选区               |
| `undo`、`redo` | 撤销、重做             |
| `external`     | `v-model` 传入了新的值 |
| `remote`       | 协同编辑中其他人的修改 |

调用 `transact(run, meta)` 时可以传入自己的 `meta.action`。

## 命令

`codeCommands` 包含所有内置的编辑和移动命令，命令名和作用见下方 [API](#codecommands)。用 `run(command)` 执行：

```ts
import { codeCommands } from '@dou-ui/code'

editor.value.run(codeCommands.toggleComment)
editor.value.focus()
```

在按钮中执行命令后焦点仍在按钮上，需要继续输入时调用 `focus()`。

`codeCommands.typeText(text)` 返回一个像键盘一样输入一段文字的命令，括号和引号会自动补全，适合做成按钮。

## 快捷键

`keymap` 添加或覆盖快捷键。键名的写法和 `useHotkey` 相同，值是要执行的命令，优先于内置快捷键。命令返回 `false` 时继续尝试下一个绑定。

```ts
import { codeCommands, type CodeKeymap } from '@dou-ui/code'

const keymap: CodeKeymap = {
  'mod+s': () => (save(), true),
  'mod+d': codeCommands.selectAll,
}
```

## API

### CodeTransaction

| 名称                      | 说明                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `doc`、`selection`        | 修改前的文本和选区                                         |
| `replace(from, to, text)` | 替换一段文字                                               |
| `insert(pos, text)`       | 插入文字                                                   |
| `delete(from, to)`        | 删除一段文字                                               |
| `replaceSelection(text)`  | 替换每个选区；`text` 可以是函数 `(range, index) => string` |
| `select(anchor, head?)`   | 设置修改后的选区，也可以传入整个选区                       |
| `setMeta(meta)`           | 设置这次修改的 `meta`                                      |

### CodeTransactionResult

| 名称      | 说明                                                   |
| --------- | ------------------------------------------------------ |
| `changes` | 这次的改动，`changes.mapPos(pos)` 把旧位置换算为新位置 |
| `before`  | 修改前的文本与选区                                     |
| `state`   | 修改后的文本与选区                                     |
| `meta`    | 修改的来源等信息                                       |

### codeCommands

| 命令                                        | 作用                                  |
| ------------------------------------------- | ------------------------------------- |
| `cursorCharLeft` / `cursorCharRight`        | 左右移动一个字符                      |
| `cursorWordLeft` / `cursorWordRight`        | 按词移动                              |
| `cursorLineStart` / `cursorLineEnd`         | 移到行首 / 行尾                       |
| `cursorLineUp` / `cursorLineDown`           | 上下移动一行                          |
| `cursorPageUp` / `cursorPageDown`           | 翻一屏                                |
| `cursorDocStart` / `cursorDocEnd`           | 移到文本开头 / 结尾                   |
| `select…`（如 `selectWordLeft`）            | 和同名的 `cursor…` 一样移动，扩大选区 |
| `selectAll`                                 | 全选                                  |
| `simplifySelection`                         | 只保留主选区                          |
| `deleteCharBackward` / `deleteCharForward`  | 删除前 / 后一个字符                   |
| `deleteWordBackward` / `deleteWordForward`  | 删除前 / 后一个词                     |
| `deleteLineStart` / `deleteLineEnd`         | 删到行首 / 行尾                       |
| `deleteLine`                                | 删除所在行                            |
| `insertNewline`                             | 换行并保留缩进                        |
| `insertTab`                                 | 插入缩进                              |
| `indentMore` / `indentLess`                 | 增加 / 减少缩进                       |
| `undo` / `redo`                             | 撤销 / 重做                           |
| `toggleComment`                             | 注释或取消注释                        |
| `moveLineUp` / `moveLineDown`               | 上移 / 下移所在行                     |
| `copyLineUp` / `copyLineDown`               | 向上 / 向下复制所在行                 |
| `cursorMatchingBracket`                     | 移到配对的括号                        |
| `selectNextOccurrence`                      | 加选下一个相同的词                    |
| `selectAllOccurrences`                      | 选中所有相同的词                      |
| `addCursorAbove` / `addCursorBelow`         | 在上一行 / 下一行添加光标             |
| `openSearch` / `openReplace`                | 打开查找 / 替换面板                   |
| `findNext` / `findPrevious`                 | 下一个 / 上一个匹配                   |
| `closeSearch`                               | 关闭查找面板                          |
| `foldCode` / `unfoldCode`                   | 折叠 / 展开光标所在的一段             |
| `foldAll` / `unfoldAll`                     | 折叠所有最外层的段 / 全部展开         |
| `startCompletion`                           | 打开补全                              |
| `showHover`                                 | 显示光标处的说明                      |
| `nextDiagnostic` / `previousDiagnostic`     | 下一个 / 上一个问题                   |
| `showFixes`                                 | 显示修复办法                          |
| `nextSnippetField` / `previousSnippetField` | 跳到代码片段的下一个 / 上一个占位     |
| `typeText(text)`                            | 返回输入一段文字的命令                |

`codeCommands.insertText(target, text)` 不是命令，不能交给 `run()`；在按钮中输入文字请使用 `typeText`。

默认快捷键见[编辑操作 · 快捷键](./editing#快捷键)。
