# 协同编辑

`@dou-ui/dashboard/collaboration` 让多人同时编辑同一个仪表盘。仪表盘保存在 [Yjs](https://yjs.dev) 的共享文档里，各端的修改会自动合并，断网期间的修改在重新连接后也会合并。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs
```

## 基础用法

用 `collaboration()` 创建协同对象，传给 `DouDashboard` 的 `collaboration` 属性。`widgets` 是共享文档里保存格子的 `Y.Map`：

```vue
<script setup lang="ts">
import { DouDashboard, type DashboardDocument } from '@dou-ui/dashboard'
import { collaboration } from '@dou-ui/dashboard/collaboration'
import { ref } from 'vue'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'sales-dashboard', doc)

const dashboard = ref<DashboardDocument>({ version: 1, widgets: [] })
const shared = collaboration({
  widgets: doc.getMap('widgets'),
  awareness: provider.awareness,
  user: { name: '戴兜' },
})
</script>

<template>
  <DouDashboard v-model="dashboard" :widgets="widgets" :collaboration="shared" editable />
</template>
```

`collaboration()` 要在 `<script setup>` 里创建一次，不要直接写在模板里。写在模板里时每次渲染都会得到一个新的对象，仪表盘会重新接入共享文档，撤销记录也会被清空。

仪表盘不负责网络传输。各端之间怎么同步共享文档由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`，也可以自己实现。

下面的示例在同一个页面里放了两个仪表盘，代表两个人。点一个格子或拖动它，另一边会用对方的颜色框出这个格子，并在上方标出名字和正在做什么（移动、调整大小、修改设置）。断开连接后分别修改，再重新连接，两边的修改会合并到一起。

<DocDemo src="dashboard/collaboration" column />

## 文档数据

使用协同编辑时，共享文档是唯一的数据来源：

- 仪表盘从共享文档读取，不读取 `v-model` 的初始值。共享文档还是空的时候例外，这时会把 `v-model` 里的仪表盘写进去。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照；`change` 事件也会触发，其他人的修改 `meta.origin` 是 `'remote'`。从外部修改 `v-model` 不会写回共享文档，要修改请用 `transaction()` 和 `dispatch`。
- 格子的每个键原样写进共享文档，只能放可以转成 JSON 的值，不能放组件或函数。开发环境下写入这类值时会在控制台警告，并指出是哪个格子的哪个键。

已有的仪表盘开始协同编辑时，也可以用 `fillMap` 把它写入空的共享文档：

```ts
import { fillMap } from '@dou-ui/dashboard/collaboration'

fillMap(doc.getMap('widgets'), dashboard)
```

这一步通常在创建共享文档时在服务器上做一次。`readMap` 反过来从共享文档读出仪表盘，例如在服务器上保存快照。

## 撤销

协同编辑时，撤销和重做只针对当前用户自己的修改，不会撤销其他人的修改。`canUndo`、`canRedo` 也按自己的修改计算。

## 同时修改时的结果

每个格子在共享文档里按键分开保存：标题、`props`、排序位置，以及每个断点上的位置。所以：

- 一个人改格子的标题、另一个人改同一个格子的设置，两个修改都会保留。
- 一个人在宽屏上移动格子、另一个人在窄屏上移动同一个格子，两个位置都会保留。
- 两个人同时修改同一个格子的同一个键，以后到的为准。`props` 作为整体保存，同时修改时也以后到的为准。
- 两个人同时移动格子，挤到一起的格子由布局按同样的规则重新排开，各端看到的结果一致。
- 自己正在拖动格子时，其他人的修改先暂缓，松手后再显示，拖动不会被打断。

## API

### collaboration 选项

| 名称        | 说明                                                                     | 类型                |
| ----------- | ------------------------------------------------------------------------ | ------------------- |
| `widgets`   | 保存格子的共享 `Y.Map`，每个格子是其中的一项                             | `Y.Map`             |
| `awareness` | 用于同步各人所在的格子（`y-protocols` 的 `Awareness`），不传时不显示他人 | `Awareness`         |
| `user`      | 当前用户，显示在其他人看到的标记上                                       | `CollaborationUser` |

```ts
interface CollaborationUser {
  name: string
  /** 标记的颜色，任意 CSS 颜色；不传时按 Yjs 的 clientID 从 collaborationColors 里选 */
  color?: string
}
```

每个人在 awareness 里的 `dashboard` 字段共享自己所在的格子，类型是 `DashboardPresence | null`：

```ts
interface DashboardPresence {
  widget: string
  /** 'focus' 选中，'move' 移动，'resize' 调整大小，'settings' 修改设置 */
  action: 'focus' | 'move' | 'resize' | 'settings'
}
```

### 函数和常量

| 名称                  | 说明                           | 类型                                                 |
| --------------------- | ------------------------------ | ---------------------------------------------------- |
| `fillMap`             | 把仪表盘写入共享文档           | `(map: Y.Map, dashboard: DashboardDocument) => void` |
| `readMap`             | 从共享文档读出仪表盘           | `(map: Y.Map) => DashboardDocument`                  |
| `collaborationColors` | 不传 `user.color` 时使用的颜色 | `string[]`                                           |

### 接入其他同步方式

`DouDashboard` 的 `collaboration` 属性接受任何实现了 `DashboardCollaboration` 的对象，不限于 Yjs。仪表盘在每次修改后调用它的 `transaction`，撤销和重做交给它处理；它通过 `setup` 拿到的 `apply` 把共享的仪表盘交给仪表盘显示。`replaceWidgets` 可以算出从一个仪表盘变成另一个所需的步骤。

| 名称                                    | 说明                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `setup`                                 | 开始同步，参数里有 `document()` 和 `apply(document, origin)`，返回停止函数 |
| `transaction`                           | 本地的一次修改，仪表盘已经显示之后调用                                     |
| `sync`                                  | 重新调用 `apply` 交出共享的仪表盘，例如拖动结束后                          |
| `undo` / `redo` / `canUndo` / `canRedo` | 撤销与重做                                                                 |
| `presence`                              | 可选，共享自己所在的格子                                                   |
| `peers`                                 | 可选，返回在某个格子上的其他人，用来显示描边和名字                         |

### CSS 变量

| 变量                         | 说明                                     |
| ---------------------------- | ---------------------------------------- |
| `--dou-dashboard-peer-color` | 其他人的描边和名字的颜色，按用户分别设置 |
