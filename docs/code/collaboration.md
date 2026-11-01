# 协同编辑

`@dou-ui/code/collaboration` 让多人同时编辑同一段代码。文本保存在 [Yjs](https://yjs.dev) 的共享文档中，各端的修改会自动合并。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs
```

## 基础用法

下面的示例用两个编辑器代表两个人。在一边输入，另一边会同步更新，并显示对方的光标和名字。断开连接后分别修改，重新连接时两边的修改会合并。

<DocDemo src="code/collaboration" column />

把 `collaboration` 扩展加到 `extensions` 中，传入共享文档中的一个 `Y.Text`：

```vue
<script setup lang="ts">
import { DouCodeEditor, typescript } from '@dou-ui/code'
import { collaboration } from '@dou-ui/code/collaboration'
import { ref } from 'vue'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'order-script', doc)

const code = ref('')
const extensions = [
  collaboration({
    text: doc.getText('code'),
    awareness: provider.awareness,
    user: { name: '戴兜' },
  }),
]
</script>

<template>
  <DouCodeEditor v-model="code" :language="typescript" :extensions="extensions" />
</template>
```

- `collaboration()` 要在 `<script setup>` 中创建一次，不要写在模板的 `:extensions` 中，否则每次渲染都会重新初始化，撤销记录也会被清空。开发环境下会在控制台警告。
- 一个扩展只能给一个编辑器使用。两个编辑器打开同一段文本时，各自创建一个扩展。
- 编辑器不负责网络传输，各端如何同步由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`。

## 文本数据

使用协同编辑时，`Y.Text` 是唯一的数据来源：

- 编辑器显示 `Y.Text` 中的文本，不使用 `v-model` 的初始值。
- 初始文本请在创建共享文档时写入一次，通常在服务器上完成：`doc.getText('code').insert(0, source)`。如果每个打开的人都写一遍，两人同时打开空文档时文本会重复。
- `v-model` 仍然会在每次修改后更新（包括其他人的修改），可以用来保存快照。从外部给 `v-model` 赋新值时，改动会写入共享文档，其他人也会看到。
- 换行统一使用 `\n`。`Y.Text` 中出现 `\r` 时开发环境下会警告。

一个共享文档中可以放多个 `Y.Text`，例如一个项目中的多个文件，每个编辑器绑定其中一个。

## 光标和选区

`awareness` 是 `y-protocols/awareness` 的实例，provider 通常会提供，例如 `provider.awareness`。不传 `awareness` 时只同步文本，不显示其他人的光标。

`user` 设置自己的名字和颜色。`color` 可以是任意 CSS 颜色，不填时从 `collaborationColors` 中按 Yjs 的客户端 id 选一个。

- 其他人的光标和选区（包括多光标）用各自的颜色显示，光标上方显示名字。
- 只有编辑器获得焦点时才会把自己的光标告诉其他人，失去焦点后其他人那边的光标随即消失。
- 其他人的光标只是绘制出来的，不影响点击、选择和复制，读屏也不会读出。

## 撤销

协同编辑时，撤销和重做只针对自己的修改。`collaboration` 扩展会替换内置的撤销记录：半秒内的连续修改合并为一步，失去焦点后开始新的一步。

## 同时修改时的结果

两个人同时修改时，Yjs 会合并两边的修改，不会丢失任何一边输入的文字：

- 在不同位置输入，两边的文字都保留。
- 在同一位置输入，两段文字都保留，每一端看到的先后顺序相同。
- 一个人删除了一段，另一个人同时在这段中输入，删除的部分不会恢复，新输入的文字保留。

其他人的修改不会打断自己的操作：输入法组字、补全列表和参数提示都会保持，自己的光标随文本移动。

## 在扩展中区分远端修改

其他人的修改以 `meta.action` 为 `'remote'` 的一步应用。它不进入撤销记录，不经过扩展的 `transaction`，但会经过 `update`，也会触发 `transaction` 事件。

## API

### collaboration(options)

| 选项        | 说明                                      | 类型                |
| ----------- | ----------------------------------------- | ------------------- |
| `text`      | 保存文本的 `Y.Text`，需要属于一个 `Y.Doc` | `Y.Text`            |
| `awareness` | 同步光标和选区，不传时不显示其他人的光标  | `AwarenessLike`     |
| `user`      | 自己的名字和颜色，需要 `awareness`        | `CollaborationUser` |

`CollaborationUser` 是 `{ name: string; color?: string }`。

### collaborationColors

默认的光标颜色，一组 8 个 CSS 颜色，和其他协同编辑的包相同，也可以从 `dou-ui` 引入。
