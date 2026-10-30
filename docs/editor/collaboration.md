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
import { DouEditor, starterKit } from '@dou-ui/editor'
import { collaboration } from '@dou-ui/editor/collaboration'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'trip-plan', doc)

const extensions = [
  starterKit(),
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

已有的文档开始协同编辑时，用 `fillMap` 把块写入一个空的共享文档：

```ts
import { fillMap } from '@dou-ui/editor/collaboration'

fillMap(doc.getMap('document'), blocks)
```

这一步只在创建共享文档时做一次，通常放在服务器上。如果两端同时往同一个空文档里写入，内容会出现两份。使用了自定义块时，把同样的 `extensions` 作为第三个参数传入。

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

```ts
interface CollaborationUser {
  name: string
  /** 光标颜色，任意 CSS 颜色 */
  color?: string
}
```

### 函数

| 名称      | 说明                     | 类型                                                 |
| --------- | ------------------------ | ---------------------------------------------------- |
| `fillMap` | 把块写入空的共享 `Y.Map` | `(map, blocks: PartialBlock[], extensions?) => void` |

### CSS 变量

| 变量                        | 说明                             |
| --------------------------- | -------------------------------- |
| `--dou-editor-cursor-color` | 光标和选区的颜色，按用户分别设置 |
