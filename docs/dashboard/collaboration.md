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
import { statWidget, textWidget } from '@dou-ui/dashboard/widgets'
import { ref } from 'vue'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'sales-dashboard', doc)

const widgets = [statWidget(), textWidget()]
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

仪表盘不像其他生态组件那样有 `extensions`，协同只需要接管文档和撤销，所以通过单独的 `collaboration` 属性接入。

`collaboration()` 要在 `<script setup>` 里创建一次，不要直接写在模板里。写在模板里时每次渲染都会得到一个新的对象，仪表盘会重新接入共享文档，撤销记录也会被清空；开发环境下这种情况会在控制台警告。

仪表盘不负责网络传输。各端之间怎么同步共享文档由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`，也可以自己实现。

下面的示例在同一个页面里放了两个仪表盘，代表两个人。点一个格子或拖动它，另一边会用对方的颜色框出这个格子，并在上方标出名字和正在做什么（移动、调整大小、修改设置）。只是选中时，名字 3 秒后淡出，只留描边。断开连接后分别修改，再重新连接，两边的修改会合并到一起。

<DocDemo src="dashboard/collaboration" column />

## 文档数据

使用协同编辑时，共享文档是唯一的数据来源：

- 仪表盘从共享文档读取，不读取 `v-model` 的初始值。共享文档还是空的时候例外，这时会把 `v-model` 里的仪表盘写进去。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照；`change` 事件也会触发，其他人的修改 `meta.origin` 是 `'remote'`。从外部修改 `v-model` 不会写回共享文档，要修改请用 `transaction()` 和 `dispatch`。
- 格子的每个键原样写进共享文档，只能放可以转成 JSON 的值，不能放组件或函数。开发环境下写入这类值时会在控制台警告，并指出是哪个格子的哪个键。

已有的仪表盘开始协同编辑时，也可以用 `fillMap` 把它写入空的共享文档：

```ts
import { fillMap } from '@dou-ui/dashboard/collaboration'

fillMap(doc.getMap('widgets'), dashboard.value)
```

这一步通常在创建共享文档时在服务器上做一次。`readMap` 反过来从共享文档读出仪表盘，例如在服务器上保存快照。

## 不经过仪表盘修改

在没有仪表盘的地方，比如服务器上，`updateMap` 把共享文档改成新的仪表盘。正在查看这个仪表盘的人会看到格子随之变化。交给程序（比如 AI）改写、过一会儿才写回时，把读到的那一份作为 `base` 传入，只有 `base` 到新仪表盘之间的差别会写进去：

```ts
import { readMap, updateMap } from '@dou-ui/dashboard/collaboration'
import type { DashboardDocument } from '@dou-ui/dashboard'
import * as Y from 'yjs'

async function rewrite(
  ydoc: Y.Doc,
  ask: (dashboard: DashboardDocument) => Promise<DashboardDocument>,
) {
  const map = ydoc.getMap('widgets')
  const base = readMap(map)
  // 交出一份副本，base 要保持读出时的样子
  const next = await ask(structuredClone(base))
  updateMap(map, next, { base, origin: 'ai' })
}
```

- 只写 `base` 和新仪表盘之间不同的地方：新加和删除的格子、改了的键（标题、`props` 等）、改了位置的断点、挪了顺序的格子。这期间其他人新加的格子、在别的断点上的移动、改的别的键都保留。同一个键两边都改了时，以新仪表盘为准。比较时不看对象里键的顺序，程序只是把键换了顺序，不算改动。
- `props` 整个算一个键：两边改了 `props` 里不同的项，也以新仪表盘为准。
- `base` 里有、新仪表盘里没有的格子会被删除；这期间被其他人删掉的格子，即使新仪表盘改了它，也保持删除。
- 新加的格子和挪了顺序的格子，排在新仪表盘里它前面那个格子的后面；排在新仪表盘最前面的，放到它后面第一个没动的格子前面；排在最后一个没动的格子之后的，放到所有格子的最后。其他格子的顺序不变。比如 `base` 是 a、b、c，这期间别人把 c 挪到了最前面（c、a、b），程序在 b 后面加了 x、在末尾加了 y（a、b、x、c、y）：x 跟在 b 后面，y 放到最后，结果是 c、a、b、x、y。
- 不要在 `base` 上原地修改再交回：新仪表盘和 `base` 是同一个对象，或者里面的格子是 `base` 里原地改过的那个时，没有差别可写，开发环境下会在控制台警告。`base` 里没改的格子原样放进新仪表盘没有问题。
- 新仪表盘里没有 `type` 的格子、和前面重复的 id 不会写入，开发环境下会在控制台警告。
- 不传 `base` 时，以共享文档现在的内容为准：新仪表盘里没有的格子都会被删除，这期间其他人的修改也会被改回去。
- 要让格子一个个出现，就每填好一个调用一次 `updateMap`，每次把上一次写入的仪表盘作为 `base`。
- `fillMap` 和 `updateMap` 都可以传 `origin`，作为这次 Yjs 事务的来源。

写入的一方也可以像其他人一样出现在仪表盘上：在它的 awareness 里设置 `user` 和 `dashboard` 字段（类型见下面的 `DashboardPresence`），其他人会看到它正在填的格子被框出，上方标出它的名字：

```ts
awareness.setLocalStateField('user', { name: 'AI 助手', color: '#7c5cff' })
awareness.setLocalStateField('dashboard', {
  widget: 'sales',
  action: 'settings',
})
// 写完后
awareness.setLocalStateField('dashboard', null)
```

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

| 名称                  | 说明                                                 | 类型                                                                               |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `fillMap`             | 把仪表盘写入空的共享文档                             | `(map: Y.Map, dashboard: DashboardDocument, options?: { origin? }) => void`        |
| `updateMap`           | 把共享文档从 `base` 改成新的仪表盘，只写有差别的地方 | `(map: Y.Map, dashboard: DashboardDocument, options?: { base?, origin? }) => void` |
| `readMap`             | 从共享文档读出仪表盘                                 | `(map: Y.Map) => DashboardDocument`                                                |
| `collaborationColors` | 不传 `user.color` 时使用的颜色                       | `string[]`                                                                         |

### 接入其他同步方式

`DouDashboard` 的 `collaboration` 属性接受任何实现了 `DashboardCollaboration` 的对象，不限于 Yjs。仪表盘在每次修改后调用它的 `transaction`，撤销和重做交给它处理；它通过 `setup` 拿到的 `apply` 把共享的仪表盘交给仪表盘显示。`replaceWidgets(tr, next, { keepComments: false })` 可以算出从一个仪表盘变成另一个所需的步骤；不传 `keepComments: false` 时会保留格子现在的 `comments`，用于“恢复默认”。

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
