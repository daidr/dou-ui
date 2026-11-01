# 用代码修改

编辑器的实例提供按块修改文档的方法：插入、修改、删除、移动块，把光标放到某个块里。每次调用都是一步撤销，和用户自己的操作一样可以撤销、重做，在协同编辑里也只撤销自己的修改。

<DocDemo src="editor/editing" column />

## 修改块

```ts
const editor = useTemplateRef('editor')

// 在光标所在的块后面插入，返回新块的 id
const [id] = editor.value!.insertBlocks([{ type: 'checkItem', content: '新的待办' }])

// 改类型和属性；props 合并到原有的属性里，文字保持不变
editor.value!.updateBlock(id, { type: 'heading', props: { level: 3 } })

// 移到另一个块前面、后面，或者成为某个块的子块
editor.value!.moveBlocks([id], { parent: 'todo-list', index: 0 })

editor.value!.removeBlocks([id])

// 获得焦点，光标放在块的末尾（'start' 放在开头）
editor.value!.focusBlock('summary')
```

`insertBlocks` 不指定位置时插在光标所在的块后面，选中了多个块时插在最后一个后面，编辑器里没有光标时插在文档末尾。块的位置用下面三种写法之一：

| 写法                          | 位置                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `{ before: id }`              | 某个块的前面                                                |
| `{ after: id }`               | 某个块的后面                                                |
| `{ parent: id, index?: n }`   | 某个块的第 `n` 个子块（从 0 开始），省略 `index` 时放在最后 |
| `{ parent: null, index?: n }` | 文档的第 `n` 个块                                           |

`updateBlock` 的第二个参数可以包含 `type`、`props`、`content`、`rows` 和 `children`，没有写的部分保持原样。`children` 会替换全部子块，传 `[]` 去掉子块。只改属性或在两种文字块之间转换时，块里的文字原样保留，协同编辑中别人正在输入的内容不受影响。

找不到 id 时，方法返回 `false`（`insertBlocks` 返回空数组），并在控制台给出提示。传入的块如果使用了文档里已有的 id，会换成新的 id，以返回值为准。只读时这些方法同样可用。

## 合成一步

多处修改要作为一步撤销时，放进 `transact`。回调里的方法和实例上的同名，id 按前面的修改完成后的文档查找：

```ts
editor.value!.transact(
  (tr) => {
    const [id] = tr.insertBlocks([{ type: 'heading', props: { level: 2 }, content: '本周' }], {
      parent: null,
      index: 0,
    })
    tr.moveBlocks(doneIds, { parent: id })
    tr.focusBlock(id)
  },
  { origin: 'archive' },
)
```

第二个参数可以设置 `history: false`，修改不进入撤销记录，适合程序自动做的整理；`origin` 会原样出现在 `transaction` 事件里，用来区分修改的来源。需要块方法以外的修改时，`tr.tr` 是底层的 ProseMirror 事务。

## 跟踪修改

`transaction` 事件在每次修改后触发，比 `update:modelValue` 早一步，给出修改涉及的块：

```ts
function onTransaction({ changes, origin }: EditorTransactionResult) {
  // changes.added / removed / updated / moved 都是块的 id
  if (origin !== 'remote') save(changes)
}
```

- `updated` 是类型、属性、文字或表格内容变了的块，子块的变化不算在父块上。
- `moved` 是换了父块，或者在兄弟块中换了位置的块。只列出真正移动的那些：把一个块移到末尾时，只有它在 `moved` 里，其他块不算。
- `origin` 是传给 `transact` 的值；外部修改 `v-model` 或调用 `setBlocks` 时为 `'external'`，协同编辑中别人的修改为 `'remote'`，用户输入和编辑器自己的操作没有 `origin`。

没有修改的块，在前后两次 `v-model` 里是同一个对象，可以直接用 `===` 判断某个块有没有变化。这些对象是共享的，不要直接修改它们，开发环境下修改会报错。要改内容，调用上面的方法，或者给 `v-model` 一个新的数组。

## 跟踪光标

`selectionChange` 在光标移到另一个块、或者选中的块变化时触发。`block` 是光标所在的最内层的块，`blocks` 是选区覆盖的块。在同一个块里移动光标不会触发。下面的目录用它高亮光标所在的小节，点击标题用 `focusBlock` 跳过去：

<DocDemo src="editor/outline" column />

随时读取当前位置用 `getSelection()`。

## 撤销

`undo()`、`redo()` 和用户按快捷键的效果一样；`canUndo`、`canRedo` 表示现在能否撤销、重做。使用协同编辑时，它们操作的是协同扩展的撤销记录。
