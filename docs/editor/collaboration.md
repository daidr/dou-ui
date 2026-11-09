# 协同编辑

`@dou-ui/editor/collaboration` 让多人同时编辑同一份文档。文档保存在 [Yjs](https://yjs.dev) 的共享文档里，各端的修改会自动合并，断网期间的修改在重新连接后也会合并。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs
```

## 基础用法

把 `collaboration` 扩展加到 `extensions` 里，传入共享文档中的一个 `Y.Map`：

```vue
<script setup lang="ts">
import { DouEditor, editorKit } from '@dou-ui/editor'
import { collaboration } from '@dou-ui/editor/collaboration'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'trip-plan', doc)

const extensions = [
  editorKit(),
  collaboration({
    map: doc.getMap('document'),
    awareness: provider.awareness,
    user: { name: '戴兜' },
  }),
]
</script>

<template>
  <DouEditor :extensions="extensions" />
</template>
```

编辑器不负责网络传输。各端之间怎么同步共享文档由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`，也可以自己实现。

下面的示例在同一个页面里放了两个编辑器，代表两个人。在一边输入，另一边会同步更新，并显示对方的光标。断开连接后分别修改，再重新连接，两边的修改会合并到一起。

<DocDemo src="editor/collaboration" column />

## 光标

传入 `awareness` 后，其他人的光标和选区会显示在编辑器里，光标上方标出名字。`user.color` 是光标的颜色，可以是任意 CSS 颜色；不设置时按客户端 id 从一组颜色中选取。

## 文档数据

使用协同编辑时，共享文档是唯一的数据来源：

- 编辑器从共享文档读取内容，不读取 `v-model` 的初始值。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照或建立搜索索引。从外部修改 `v-model` 不会写回编辑器，以免覆盖其他人的修改。
- `setBlocks` 相当于当前用户替换了整个文档，会同步给其他人。

已有的文档开始协同编辑时，用 `fillMap` 把它写入一个空的共享文档：

```ts
import { fillMap } from '@dou-ui/editor/collaboration'

fillMap(doc.getMap('document'), saved)
```

这一步只在创建共享文档时做一次，通常放在服务器上。如果两端同时往同一个空文档里写入，内容会出现两份。使用了自定义块时，把编辑器用的扩展传给 `extensions` 选项：`fillMap(map, saved, { extensions })`。

### 在服务器上写入新版本

在没有编辑器的地方要改动正在协同编辑的文档时，用 `updateMap`。典型的场景是把文档交给 AI 改写：读出文档、转成 Markdown 交给 AI，几十秒后拿回新的 Markdown 写回去。这期间其他人可能还在编辑，所以要把 AI 读到的那一份作为 `base` 传入，`updateMap` 只把 `base` 到新版本之间的差别写进共享文档：

```ts
import { editorKit } from '@dou-ui/editor'
import { readMap, updateMap } from '@dou-ui/editor/collaboration'
import { blocksToMarkdown, markdownToBlocks } from '@dou-ui/editor/markdown'
import { Window } from 'happy-dom'
import * as Y from 'yjs'

const extensions = [editorKit()]
// 服务器上没有 DOMParser，从 DOM 库里取一个，见“导入和导出”
const domParser = new new Window().DOMParser()

async function rewrite(ydoc: Y.Doc, ask: (markdown: string) => Promise<string>) {
  const map = ydoc.getMap('document')
  const markdown = blocksToMarkdown(readMap(map, { extensions }).blocks, extensions)
  const answer = await ask(markdown)
  updateMap(
    map,
    { version: 1, blocks: markdownToBlocks(answer, extensions, { domParser }) },
    {
      // AI 读到的那一份，和新版本用同样的方式读出来
      base: { version: 1, blocks: markdownToBlocks(markdown, extensions, { domParser }) },
      extensions,
      origin: 'ai',
    },
  )
}
```

- 只有 `base` 和新版本之间不同的块会被改动、新增或删除，其他人这期间输入的文字、新加的块、移动过的块都保留。同一个块两边都改了时，以新版本为准。
- 这期间被其他人删掉的块保持删除，即使新版本改了它；被其他人改得面目全非、对应不上的块也不会被再写一份，这时新版本对这一块的修改不会写进去。
- 改动是按块写的：块保留 id，文字按字符改，所以其他人的光标、撤销和评论都留在原处。
- 从 Markdown 读出来的块没有原来的 id，会按内容和位置找到对应的块：内容相同的先对上，其余的找同一类型里文字最接近的；都对不上的，当作删掉一块、新加一块，这个块上的光标和评论就不在了。想完全保留，可以让程序带着 `readMap` 读出的块（有 id）去改，改完的块直接传给 `updateMap`。
- Markdown 带不出评论，文字没变的地方评论会保留；Markdown 带不出的其他格式（比如文字颜色、对齐），在改动过的块里会丢掉。
- `base` 要和新版本用同样的方式得到，比如都从 Markdown 读出来，否则 Markdown 带不出的那些差别也会被当成改动。不传 `base` 时，以共享文档现在的内容为准，这期间其他人的修改会被改回去。
- `origin` 是这次 Yjs 事务的来源，用来区分是谁写的。空的共享文档会直接写入。

### 显示写入方的光标

写入的一方也可以像其他协作者一样，在文档里显示光标和名字。名字和颜色放在 awareness 的 `user` 字段，光标放在 `cursor` 字段，值用 `cursorAt` 得到：给出块的 id 和块内文字的位置，不需要编辑器。

```ts
import { cursorAt, readMap, updateMap } from '@dou-ui/editor/collaboration'

awareness.setLocalStateField('user', { name: 'AI 助手', color: '#7c5cff' })

// 每写一段之后，把光标放到刚写的地方，比如续写时放在最后一个块的末尾
updateMap(map, next, { base, extensions, origin: 'ai' })
const last = readMap(map, { extensions }).blocks.at(-1)
awareness.setLocalStateField('cursor', last ? cursorAt(map, { block: last.id }) : null)

// 写完后
awareness.setLocalStateField('cursor', null)
```

- `offset` 是块内文字的位置，按字符串的 `length` 计算，提及这类行内节点算一个字符；超出文字长度时放在末尾，不传时也放在末尾。
- 表格的文字在格子里，要再给出 `cell`，格式是 `行 id:列 id`。
- 传入第三个参数 `anchor` 时显示一段选区，从 `anchor` 到光标所在的位置。
- 光标记的是文字里的相对位置，之后其他人在它前面输入或删除文字，光标会跟着移动。
- 块不存在或者没有文字（比如图片、没给 `cell` 的表格）时返回 `null`。
- 从 Markdown 读出的块没有 id，写入时会对上原来的块或者得到新的 id，所以要在 `updateMap` 之后用 `readMap` 读出 id。

## 评论

传入 `comments` 后，[评论](./comments)也放在共享文档里，新的讨论和回复会实时出现在每个人那里。这时不用再写 `v-model:comments`，编辑器从共享文档里读取讨论。下面的示例里两个人都可以选中文字发起讨论。

## 撤销

协同编辑时，撤销和重做只针对当前用户自己的修改，不会撤销其他人的输入。`collaboration` 扩展会替换内置的撤销记录，不需要再设置 `history`、`undo` 和 `redo`。

## 同时修改时的结果

每个块在共享文档里单独保存：文字、类型、属性，以及它的父块和在兄弟块中的顺序。移动、缩进只修改块的位置，块里的文字不动，所以：

- 一个人拖动或缩进某个块时，另一个人在这个块里输入的文字仍然留在这个块里。
- 两个人同时移动同一个块，以后到的移动为准。块只会出现在一个位置，不会重复，也不会丢失。
- 两个人同时把两个块拖进对方（A 拖进 B，B 拖进 A），会按固定的规则拆开其中一层，所有人看到的结果相同。
- 一个人删除某个块时，另一个人刚好把别的块移进了它，移进去的块会留在顶层，不会随之删除。
- 一个人删除某个块时，另一个人在这个块里输入的文字会随块一起删除。
- 两个人在同一个位置插入新块，两个块都会保留，前后顺序在所有人那里一致。

表格的行、列和每个格子也分开保存，合并单元格记录它覆盖的行和列：

- 一个人移动某一行时，另一个人在这一行里输入的文字跟着这一行移动。
- 一个人插入一列、另一个人插入一行，新的行里也有新的列。
- 一个人删除一列时，另一个人在这一列里输入的文字随列一起删除，其他格子不受影响。
- 一个人合并一块区域时，另一个人在被盖住的格子里输入的文字会保留下来，取消合并后重新显示。
- 两个人同时合并互相重叠的区域，只保留其中一个，所有人看到的结果相同。
- 合并区域里的行被删除时，合并区域随之缩小；在合并区域中间插入的行会落在合并区域里。

## API

### collaboration 选项

| 名称        | 说明                                                                         | 类型                |
| ----------- | ---------------------------------------------------------------------------- | ------------------- |
| `map`       | 保存文档的共享 `Y.Map`，每个块是其中的一项                                   | `Y.Map`             |
| `awareness` | 用于同步光标和选区（`y-protocols` 的 `Awareness`），不传时不显示其他人的光标 | `Awareness`         |
| `user`      | 当前用户，显示在其他人看到的光标上                                           | `CollaborationUser` |
| `comments`  | 保存[评论](./comments)的共享 `Y.Map`，不传时讨论由应用自己同步               | `Y.Map`             |

```ts
interface CollaborationUser {
  name: string
  /** 光标颜色，任意 CSS 颜色 */
  color?: string
}
```

### 函数

| 名称        | 说明                                                  | 类型                                                                                          |
| ----------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `fillMap`   | 把文档写入空的共享 `Y.Map`                            | `(map, doc: EditorDocument<PartialBlock>, options?: { extensions?, origin? }) => void`        |
| `updateMap` | 把共享 `Y.Map` 从 `base` 改成 `doc`，只写有差别的地方 | `(map, doc: EditorDocument<PartialBlock>, options?: { base?, extensions?, origin? }) => void` |
| `readMap`   | 从共享 `Y.Map` 读出文档                               | `(map, options?: { extensions? }) => EditorDocument`                                          |
| `cursorAt`  | 得到放进 awareness `cursor` 字段的光标，不需要编辑器  | `(map, head: CursorTarget, anchor?: CursorTarget) => EditorCursor \| null`                    |

`extensions` 是编辑器用的扩展，默认 `[editorKit()]`；`origin` 是 Yjs 事务的来源。

每个人在 awareness 里的 `cursor` 字段共享自己的光标，类型是 `EditorCursor | null`：

```ts
interface CursorTarget {
  block: string
  /** 表格的格子，`行 id:列 id` */
  cell?: string
  /** 块内文字的位置，不传时为末尾 */
  offset?: number
}

interface EditorCursorPlace {
  block: string
  cell?: string
  /** Yjs 相对位置的 JSON（Y.relativePositionToJSON） */
  position: unknown
}

interface EditorCursor {
  /** 选区的起点，和 head 相同时只显示光标 */
  anchor: EditorCursorPlace
  /** 光标和名字所在的位置 */
  head: EditorCursorPlace
}
```

### CSS 变量

| 变量                        | 说明                             |
| --------------------------- | -------------------------------- |
| `--dou-editor-cursor-color` | 光标和选区的颜色，按用户分别设置 |
