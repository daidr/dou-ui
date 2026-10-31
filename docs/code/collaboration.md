# 协同编辑

`@dou-ui/code/collaboration` 让多人同时编辑同一段代码。文本保存在 [Yjs](https://yjs.dev) 的共享文档里，各端的修改会自动合并，断网期间的修改在重新连接后也会合并。每个人的光标和选区用各自的颜色显示，光标上方标着名字。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs
```

## 基础用法

把 `collaboration` 扩展加到 `extensions` 里，传入共享文档中的一个 `Y.Text`：

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

`collaboration()` 要在 `<script setup>` 里创建一次，不要直接写在模板的 `:extensions` 里。写在模板里时每次渲染都会得到一个新的扩展，编辑器会重新初始化它，撤销记录也会被清空；开发环境下这种情况会在控制台警告。一个扩展只给一个编辑器用，两个编辑器打开同一段文本时各自创建一个。

编辑器不负责网络传输。各端之间怎么同步共享文档由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`，也可以自己实现。

下面的示例在同一个页面里放了两个编辑器，代表两个人。在一边输入，另一边马上更新，并在输入的位置显示对方的光标和名字；选中一段文字，另一边会用对方的颜色标出来。断开连接后分别修改，再重新连接，两边的修改会合并到一起。

<DocDemo src="code/collaboration" column />

## 文本数据

使用协同编辑时，共享文档里的 `Y.Text` 是唯一的数据来源：

- 编辑器打开时显示 `Y.Text` 里的文本，不使用 `v-model` 的初始值。`Y.Text` 还是空的而 `v-model` 不是空的时候，开发环境下会在控制台警告。
- 初始文本请在创建共享文档时写入一次，通常在服务器上完成：`doc.getText('code').insert(0, source)`。不要让每个打开的人都写一遍：两个人同时打开空文档时，会各写入一份，文本就重复了。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照。从外部给 `v-model` 一个新的字符串时，编辑器算出改动的那一段，作为自己的修改写入共享文档，其他人也会看到。
- 换行统一用 `\n`。编辑器里没有 `\r`，`Y.Text` 里出现 `\r` 时位置会对不上，开发环境下会在控制台警告。

一个共享文档里可以放多个 `Y.Text`，比如一个项目里的多个文件，每个编辑器绑定其中一个。光标只在同一个 `Y.Text` 的编辑器里显示。

## 光标和选区

`awareness` 是 `y-protocols/awareness` 的实例，provider 一般会提供，例如 `provider.awareness`。每个人的光标、选区（包括多光标）都通过它告诉其他人，位置会跟着文本的修改移动。只有在编辑器获得焦点时才会告诉其他人；点到编辑器外面后，其他人那边的光标随即消失，回来后再出现。不传 `awareness` 时只同步文本，不显示其他人的光标。

`user` 是自己的名字和颜色，`color` 可以是任意 CSS 颜色，不填时按 Yjs 的客户端 id 从 `collaborationColors` 里选一个。这组颜色饱和度较低，在浅色和深色背景上都看得清；名字的文字颜色会按底色的明暗自动选深色或浅色。名字显示在光标上方，光标在第一行时显示在下方。

其他人的光标只是画出来的，不是文本的一部分：点击、选择和复制都不受影响，读屏也不会读出来。

## 撤销

协同编辑时，撤销和重做只针对当前用户自己的修改，不会撤销其他人的修改。`collaboration` 扩展会替换内置的撤销记录：半秒内的连续修改合成一步，编辑器失去焦点后开始新的一步；撤销后光标回到修改前的位置，这个位置同样会跟着其他人的修改移动。

## 同时修改时的结果

两个人同时修改时，Yjs 会合并两边的修改，不会丢掉任何一边输入的文字：

- 在不同位置输入，两边的文字都保留。
- 在同一个位置输入，两段文字都保留，按 Yjs 的规则排出固定的先后，每一端看到的结果都一样。
- 一个人删掉了一段，另一个人同时在这段里输入，删掉的部分不会恢复，新输入的文字保留下来。

其他人的修改不会打断自己的操作：输入法正在组字时，组字的位置会跟着移动，确认后落在正确的地方；补全列表和参数提示在对方改的不是自己正在输入的这一段时保持打开；自己的光标跟着文本移动，不会被滚动到别处。

## 扩展里的远端修改

其他人的修改在编辑器里以 `meta.action` 为 `'remote'` 的一步应用：它不进入撤销记录，不经过扩展的 `transaction`，但会经过 `update`，`@transaction` 事件也会收到它。需要区分时看 `meta.action`。

## API

### collaboration(options)

| 参数        | 说明                                                 | 类型                |
| ----------- | ---------------------------------------------------- | ------------------- |
| `text`      | 保存文本的 `Y.Text`，需要在一个 `Y.Doc` 里           | `Y.Text`            |
| `awareness` | 同步光标和选区，不传时不显示其他人的光标             | `AwarenessLike`     |
| `user`      | 自己的名字和颜色，显示在其他人那边；需要 `awareness` | `CollaborationUser` |

`CollaborationUser` 是 `{ name: string; color?: string }`。

### collaborationColors

默认的光标颜色，一组 8 个 CSS 颜色。它和其他协同编辑的包用的是同一组，也可以从 `dou-ui` 引入。
