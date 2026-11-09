# 协同编辑

`@dou-ui/gantt/collaboration` 让多人同时编辑同一份排期。任务和依赖保存在 [Yjs](https://yjs.dev) 的共享文档里，各端的修改会自动合并，断网期间的修改在重新连接后也会合并。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs
```

## 基础用法

把 `collaboration` 扩展加到 `extensions` 里，传入共享文档中的两个 `Y.Map`，分别保存任务和依赖：

```vue
<script setup lang="ts">
import { DouGantt, type GanttDocument } from '@dou-ui/gantt'
import { collaboration } from '@dou-ui/gantt/collaboration'
import { ref } from 'vue'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'shop-opening', doc)

const plan = ref<GanttDocument>({ version: 1, tasks: [], links: [] })
const extensions = [
  collaboration({
    tasks: doc.getMap('tasks'),
    links: doc.getMap('links'),
    awareness: provider.awareness,
    user: { name: '戴兜' },
  }),
]
</script>

<template>
  <DouGantt v-model="plan" :extensions="extensions" />
</template>
```

`collaboration()` 要像上面这样在 `<script setup>` 里创建一次。写在模板里（`:extensions="[collaboration({ ... })]"`）时，每次渲染都会创建一个新的扩展，协同会重新设置一次，撤销记录也会被清空。

甘特图不负责网络传输。各端之间怎么同步共享文档由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`，也可以自己实现。

下面的示例在同一个页面里放了两个甘特图，代表两个人。在一边拖动任务，另一边会显示拖动中的虚线框和名字，松手后同步更新；选中的任务也会用对方的颜色框出来。断开连接后分别修改，再重新连接，两边的修改会合并到一起。

<DocDemo src="gantt/collaboration" column />

## 任务数据

使用协同编辑时，共享文档是唯一的数据来源：

- 甘特图从共享文档读取任务和依赖，不读取 `v-model` 的初始值。共享文档还是空的时候例外，这时会把 `v-model` 里的任务写进去。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照。从外部修改 `v-model` 不会写回共享文档，要修改请用 `transact`。
- 每个任务都会得到 `order` 排序键，这样所有人看到的顺序相同。

已有的排期开始协同编辑时，也可以用 `fillMaps` 把任务和依赖写入空的共享文档：

```ts
import { fillMaps } from '@dou-ui/gantt/collaboration'

fillMaps({ tasks: doc.getMap('tasks'), links: doc.getMap('links') }, plan)
```

这一步通常在创建共享文档时在服务器上做一次。任务和依赖按 id 保存，即使两端同时写入同一份排期，也不会出现重复的任务。`fillMaps` 可以传 `origin`，作为这次 Yjs 事务的来源：`fillMaps(maps, plan, { origin: 'server' })`。

## 撤销

协同编辑时，撤销和重做只针对当前用户自己的修改，不会撤销其他人的修改。`collaboration` 扩展会替换内置的撤销记录。

## 自动排期

`scheduling="auto"` 时，由修改任务的人计算哪些任务需要推后，推后的结果和这次修改一起同步给其他人，作为同一步撤销。其他人收到修改时不会再推一次。

## 同时修改时的结果

每个任务在共享文档里按字段分开保存：名称、开始、结束、进度、父任务、排序键等。所以：

- 一个人改任务名、另一个人拖动同一个任务，两个修改都会保留。
- 两个人同时修改同一个任务的同一个字段（例如都拖动了它），以后到的为准；开始和结束分别以后到的为准，可能来自不同的人。
- 两个人在同一个位置添加任务，两个任务都会保留，前后顺序在所有人那里一致。
- 一个人删除某个汇总任务时，另一个人刚好把别的任务移进了它，移进去的任务会留在最外层，不会随之删除。
- 依赖指向的任务被删除后，这条依赖不再显示。
- `data` 作为一个整体保存，两个人同时修改同一个任务的 `data` 时，以后到的为准。

共享的字段只能放可以转成 JSON 的值。`data` 里放组件或函数时，自己这边显示正常，但其他人收到的是去掉函数后的对象，例如图标会消失。可以在 `data` 里只存名称，显示时再按名称找到组件。开发环境下遇到这种值，控制台会提示是哪个任务的哪个字段。

展开、收起汇总任务只影响自己，不会同步给其他人。

## API

### collaboration 选项

| 名称        | 说明                                                                           | 类型                |
| ----------- | ------------------------------------------------------------------------------ | ------------------- |
| `tasks`     | 保存任务的共享 `Y.Map`，每个任务是其中的一项                                   | `Y.Map`             |
| `links`     | 保存依赖的共享 `Y.Map`，和 `tasks` 在同一个 `Y.Doc` 里                         | `Y.Map`             |
| `awareness` | 用于同步选中和拖动（`y-protocols` 的 `Awareness`），不传时不显示其他人在做什么 | `Awareness`         |
| `user`      | 当前用户，显示在其他人看到的框上                                               | `CollaborationUser` |

```ts
interface CollaborationUser {
  name: string
  /** 框和名字的颜色，任意 CSS 颜色 */
  color?: string
}
```

### 函数和常量

| 名称                  | 说明                           | 类型                                                                     |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| `fillMaps`            | 把任务和依赖写入共享文档       | `({ tasks, links }, plan: GanttDocument, options?: { origin? }) => void` |
| `collaborationColors` | 不传 `user.color` 时使用的颜色 | `string[]`                                                               |

### CSS 变量

| 变量                     | 说明                                   |
| ------------------------ | -------------------------------------- |
| `--dou-gantt-peer-color` | 其他人的框和名字的颜色，按用户分别设置 |
