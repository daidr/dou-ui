# 协同编辑

`@dou-ui/editor/collaboration` 让多人同时编辑同一份文档。文档保存在 [Yjs](https://yjs.dev) 的共享文档里，各端的修改会自动合并，断网期间的修改在重新连接后也会合并。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs y-prosemirror y-protocols
```

## 基础用法

把 `collaboration` 扩展加到 `extensions` 里，传入共享文档中的一个 `XmlFragment`：

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
    fragment: doc.getXmlFragment('document'),
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

传入 `awareness` 后，其他人的光标和选区会显示在编辑器里，光标上方标出名字。`user.color` 是光标的颜色，需要写成 6 位十六进制，例如 `#3b6ea8`；不设置时按客户端 id 从一组颜色中选取。

## 文档数据

使用协同编辑时，共享文档是唯一的数据来源：

- 编辑器从共享文档读取内容，不读取 `v-model` 的初始值。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照或建立搜索索引。从外部修改 `v-model` 不会写回编辑器，以免覆盖其他人的修改。
- `setBlocks` 相当于当前用户替换了整个文档，会同步给其他人。

已有的文档开始协同编辑时，用 `fillFragment` 把块写入一个空的共享文档：

```ts
import { fillFragment } from '@dou-ui/editor/collaboration'

fillFragment(doc.getXmlFragment('document'), blocks)
```

这一步只在创建共享文档时做一次，通常放在服务器上。如果两端同时往同一个空文档里写入，内容会出现两份。使用了自定义块时，把同样的 `extensions` 作为第三个参数传入。

## 撤销

协同编辑时，撤销和重做只针对当前用户自己的修改，不会撤销其他人的输入。`collaboration` 扩展会替换内置的撤销记录，不需要再设置 `history`、`undo` 和 `redo`。

## 已知限制

Yjs 没有“移动”操作，移动块会被记录为相邻块内容的改写。如果一个人拖动某个块时，另一个人正在修改这个块的文字，两边仍会得到一致的结果，文字也不会丢失，但后者的修改可能会落到移动后占据原位置的块里。

## API

### collaboration 选项

| 名称        | 说明                                         | 类型                |
| ----------- | -------------------------------------------- | ------------------- |
| `fragment`  | 保存文档的共享片段                           | `Y.XmlFragment`     |
| `awareness` | 用于同步光标和选区，不传时不显示其他人的光标 | `Awareness`         |
| `user`      | 当前用户，显示在其他人看到的光标上           | `CollaborationUser` |

```ts
interface CollaborationUser {
  name: string
  /** 6 位十六进制颜色 */
  color?: string
}
```

### 函数

| 名称           | 说明                 | 类型                                                      |
| -------------- | -------------------- | --------------------------------------------------------- |
| `fillFragment` | 把块写入空的共享片段 | `(fragment, blocks: PartialBlock[], extensions?) => void` |

### CSS 变量

| 变量                        | 说明                             |
| --------------------------- | -------------------------------- |
| `--dou-editor-cursor-color` | 光标和选区的颜色，按用户分别设置 |
