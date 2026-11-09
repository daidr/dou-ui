---
wide: true
---

# 协同编辑

`@dou-ui/form-builder/collaboration` 让多人同时编辑同一张表单。表单保存在 [Yjs](https://yjs.dev) 的共享文档里，各端的修改会自动合并，断网期间的修改在重新连接后也会合并。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs
```

## 基础用法

把 `collaboration` 扩展加到设计器的 `extensions` 里，传入共享文档中的两个 `Y.Map`，分别保存节点和表单自身的设置：

```vue
<script setup lang="ts">
import { DouFormBuilder, type FormDocument } from '@dou-ui/form-builder'
import { collaboration } from '@dou-ui/form-builder/collaboration'
import { ref } from 'vue'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'signup-form', doc)

const form = ref<FormDocument>({ version: 1, nodes: [] })
const extensions = [
  collaboration({
    nodes: doc.getMap('nodes'),
    settings: doc.getMap('settings'),
    awareness: provider.awareness,
    user: { name: '戴兜' },
  }),
]
</script>

<template>
  <DouFormBuilder v-model="form" :extensions="extensions" />
</template>
```

`collaboration()` 要在 `<script setup>` 里创建一次，不要直接写在模板的 `:extensions` 里。写在模板里时每次渲染都会得到一个新的扩展，设计器会重新初始化它，撤销记录也会被清空；开发环境下这种情况会在控制台警告。

设计器不负责网络传输。各端之间怎么同步共享文档由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`，也可以自己实现。

下面的示例在同一个页面里放了两个设计器，代表两个人。一边选中的字段，另一边会用对方的颜色框出来并标上名字，结构树里也有同色的圆点。断开连接后分别修改，再重新连接，两边的修改会合并到一起。

<DocDemo src="form-builder/collaboration" column />

## 文档数据

使用协同编辑时，共享文档是唯一的数据来源：

- 设计器从共享文档读取表单，不读取 `v-model` 的初始值。共享文档还是空的时候例外，这时会把 `v-model` 里的表单写进去。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照。从外部修改 `v-model` 不会写回共享文档，要修改请用 `dispatch` 或 `replace`。
- 节点的每个键原样写进共享文档，只能放可以转成 JSON 的值，不能放组件或函数。自己这边仍然能看到，其他人那边就丢了，所以开发环境下写入这类值时会在控制台警告，并指出是哪个节点的哪个键。

已有的表单开始协同编辑时，也可以用 `fillMaps` 把它写入空的共享文档：

```ts
import { fillMaps } from '@dou-ui/form-builder/collaboration'

fillMaps({ nodes: doc.getMap('nodes'), settings: doc.getMap('settings') }, form)
```

这一步通常在创建共享文档时在服务器上做一次。`readMaps` 反过来从共享文档读出表单，例如在服务器上保存快照。`fillMaps` 的第三个参数可以传 `{ origin }`，作为这次 Yjs 事务的来源。

## 撤销

协同编辑时，撤销和重做只针对当前用户自己的修改，不会撤销其他人的修改，撤销后会选中修改前选中的节点。`collaboration` 扩展会替换内置的撤销记录。

## 同时修改时的结果

每个节点在共享文档里按键分开保存：标签、字段名、规则、`props` 等，以及它所在的容器和排序位置。排序位置是一个可以插在任意两个值之间的字符串，移动节点时只改这一个节点。所以：

- 一个人改字段的标签、另一个人改同一个字段的提示文字，两个修改都会保留。
- 两个人同时修改同一个字段的同一个键，以后到的为准。`props`、`rules` 这类对象作为整体保存，同时修改时也以后到的为准。
- 两个人同时在同一个位置插入字段，两个字段都会保留，各端的顺序一致。
- 一个人删除分组时，另一个人刚好把别的字段移进了它，移进去的字段会留在表单最外层，不会随之删除。
- 两个人同时把两个分组互相移进对方，id 较小的分组会回到最外层，各端结果一致。

## API

### collaboration 选项

| 名称        | 说明                                                                                     | 类型                |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------- |
| `nodes`     | 保存节点的共享 `Y.Map`，每个节点是其中的一项                                             | `Y.Map`             |
| `settings`  | 保存表单自身设置（如 `layout`、`columns`）的共享 `Y.Map`，和 `nodes` 在同一个 `Y.Doc` 里 | `Y.Map`             |
| `awareness` | 用于同步选中（`y-protocols` 的 `Awareness`），不传时不显示其他人选中了什么               | `Awareness`         |
| `user`      | 当前用户，显示在其他人看到的标记上                                                       | `CollaborationUser` |

```ts
interface CollaborationUser {
  name: string
  /** 标记的颜色，任意 CSS 颜色；不传时按 Yjs 的 clientID 从 collaborationColors 里选 */
  color?: string
}
```

### 函数和常量

| 名称                  | 说明                           | 类型                                                                       |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `fillMaps`            | 把表单写入共享文档             | `({ nodes, settings }, form: FormDocument, options?: { origin? }) => void` |
| `readMaps`            | 从共享文档读出表单             | `({ nodes, settings }) => { document: FormDocument; lifted: string[] }`    |
| `collaborationColors` | 不传 `user.color` 时使用的颜色 | `string[]`                                                                 |

`readMaps` 返回的 `lifted` 是因为容器被删除或互相嵌套而回到最外层的节点。

### CSS 变量

| 变量                      | 说明                                               |
| ------------------------- | -------------------------------------------------- |
| `--dou-form-builder-mark` | 其他人的框、名字和结构树圆点的颜色，按用户分别设置 |
