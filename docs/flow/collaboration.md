# 协同编辑

`@dou-ui/flow/collaboration` 让多人同时编辑同一个流程。节点和连线保存在 [Yjs](https://yjs.dev) 的共享文档里，各端的修改会自动合并，断网期间的修改在重新连接后也会合并。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs
```

## 基础用法

把 `collaboration` 扩展加到 `extensions` 里，传入共享文档中的两个 `Y.Map`，分别保存节点和连线：

```vue
<script setup lang="ts">
import { DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { collaboration } from '@dou-ui/flow/collaboration'
import { ref } from 'vue'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'weekly-report', doc)

const flow = ref<FlowDocument>({ version: 1, nodes: [], edges: [] })
const extensions = [
  flowKit(),
  collaboration({
    nodes: doc.getMap('nodes'),
    edges: doc.getMap('edges'),
    awareness: provider.awareness,
    user: { name: '戴兜' },
  }),
]
</script>

<template>
  <DouFlowEditor v-model="flow" :extensions="extensions" />
</template>
```

`collaboration()` 要在 `<script setup>` 里创建一次，不要直接写在模板的 `:extensions` 里。写在模板里时每次渲染都会得到一个新的扩展，编辑器会重新初始化它，撤销记录也会被清空；开发环境下这种情况会在控制台警告。

编辑器不负责网络传输。各端之间怎么同步共享文档由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`，也可以自己实现。

下面的示例在同一个页面里放了两个编辑器，代表两个人。在一边拖动节点，另一边会显示拖动中的虚线框和名字，松手后同步更新；选中的节点会用对方的颜色框出来，正在拉出的连线也会显示。断开连接后分别修改，再重新连接，两边的修改会合并到一起。

<DocDemo src="flow/collaboration" column />

## 文档数据

使用协同编辑时，共享文档是唯一的数据来源：

- 编辑器从共享文档读取节点和连线，不读取 `v-model` 的初始值。共享文档还是空的时候例外，这时会把 `v-model` 里的节点和连线写进去。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照。从外部修改 `v-model` 不会写回共享文档，要修改请用 `transact`。
- 节点的 `data` 会原样写进共享文档，只能放可以转成 JSON 的值，不能放组件或函数。需要图标时，在 `data` 里存名字，在自定义节点里换成组件。自己这边仍然能看到组件，其他人那边就丢了，所以开发环境下写入这类值时会在控制台警告，并指出是哪个节点的哪个字段。
- 图片等文件不要以 data URL 存在 `data` 里：共享文档会变得很大，每个人打开都要整份下载。白板请传入 `whiteboardKit({ upload })`。开发环境下写入超过 100 KB 的 data URL 时，控制台会警告一次。

已有的流程开始协同编辑时，也可以用 `fillMaps` 把节点和连线写入空的共享文档：

```ts
import { fillMaps } from '@dou-ui/flow/collaboration'

fillMaps({ nodes: doc.getMap('nodes'), edges: doc.getMap('edges') }, flow.value)
```

这一步通常在创建共享文档时在服务器上做一次。节点和连线按 id 保存，即使两端同时写入同一个流程，也不会出现重复的节点。

在没有编辑器的地方，`readMaps` 读出共享文档里的流程（比如在服务器上保存版本），`updateMaps` 把它改成新的流程。交给程序（比如 AI）改写、过一会儿才写回时，把读到的那一份作为 `base` 传入，只有 `base` 到新流程之间的差别会写进去：

```ts
import { readMaps, updateMaps } from '@dou-ui/flow/collaboration'
import type { FlowDocument } from '@dou-ui/flow'
import * as Y from 'yjs'

async function rewrite(ydoc: Y.Doc, ask: (flow: FlowDocument) => Promise<FlowDocument>) {
  const maps = { nodes: ydoc.getMap('nodes'), edges: ydoc.getMap('edges') }
  const base = readMaps(maps)
  // 交出一份副本，base 要保持读出时的样子
  const next = await ask(structuredClone(base))
  updateMaps(maps, next, { base, origin: 'ai' })
}
```

- 只写 `base` 和新流程之间不同的字段；这期间其他人移动的节点、新加的节点和连线、改的别的字段都保留。同一个字段两边都改了时，以新流程为准。比较时不看对象里键的顺序，程序只是把键换了顺序，不算改动。
- 不要在 `base` 上原地修改再交回：新流程和 `base` 是同一个对象，或者里面的节点、连线是 `base` 里原地改过的那个时，没有差别可写，开发环境下会在控制台警告。`base` 里没改的节点和连线原样放进新流程没有问题。
- `base` 里有、新流程里没有的节点和连线会被删除；这期间被其他人删掉的，即使新流程改了它，也保持删除。新流程里新加的连线如果连到这期间被删掉的节点，不会写入。
- 不传 `base` 时，以共享文档现在的内容为准：新流程里没有的节点和连线都会被删除，这期间其他人的修改也会被改回去。
- `readMaps` 读出的节点和连线顺序不固定，两次读取、两个客户端之间都可能不同。
- `fillMaps` 和 `updateMaps` 都可以传 `origin`，作为这次 Yjs 事务的来源。

## 拖动

拖动节点、调整连线和改变分组大小时，过程中只把位置告诉其他人，他们看到的是一个虚线框；松手后才写入共享文档，作为一步撤销。按 Esc 取消拖动时不会写入。

## 撤销

协同编辑时，撤销和重做只针对当前用户自己的修改，不会撤销其他人的修改。`collaboration` 扩展会替换内置的撤销记录。

## 同时修改时的结果

每个节点在共享文档里按字段分开保存：位置、尺寸、类型、所在分组、`data` 等，连线也一样。所以：

- 一个人改节点的内容、另一个人拖动同一个节点，两个修改都会保留。
- 两个人同时修改同一个节点的同一个字段（例如都拖动了它），以后到的为准；横、纵坐标分别以后到的为准，可能来自不同的人。
- 连线的一端被其他人删除后，这条连线会被删掉。
- 一个人删除分组时，另一个人刚好把别的节点移进了它，移进去的节点会留在最外层，不会随之删除。
- `data` 作为一个整体保存，两个人同时修改同一个节点的 `data` 时，以后到的为准。

展开、收起分组只影响自己，不会同步给其他人。

## API

### collaboration 选项

| 名称        | 说明                                                                                 | 类型                |
| ----------- | ------------------------------------------------------------------------------------ | ------------------- |
| `nodes`     | 保存节点的共享 `Y.Map`，每个节点是其中的一项                                         | `Y.Map`             |
| `edges`     | 保存连线的共享 `Y.Map`，和 `nodes` 在同一个 `Y.Doc` 里                               | `Y.Map`             |
| `awareness` | 用于同步选中、拖动和连线（`y-protocols` 的 `Awareness`），不传时不显示其他人在做什么 | `Awareness`         |
| `user`      | 当前用户，显示在其他人看到的框上                                                     | `CollaborationUser` |

```ts
interface CollaborationUser {
  name: string
  /** 框和名字的颜色，任意 CSS 颜色；不传时按 Yjs 的 clientID 从 collaborationColors 里选 */
  color?: string
}
```

### 函数和常量

| 名称                  | 说明                                             | 类型                                                                          |
| --------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `fillMaps`            | 把节点和连线写入共享文档                         | `({ nodes, edges }, doc: FlowDocument, options?: { origin? }) => void`        |
| `readMaps`            | 从共享文档读出流程                               | `({ nodes, edges }) => FlowDocument`                                          |
| `updateMaps`          | 把共享文档从 `base` 改成 `doc`，只写有变化的字段 | `({ nodes, edges }, doc: FlowDocument, options?: { base?, origin? }) => void` |
| `collaborationColors` | 不传 `user.color` 时使用的颜色                   | `string[]`                                                                    |

### CSS 变量

| 变量                    | 说明                                         |
| ----------------------- | -------------------------------------------- |
| `--dou-flow-peer-color` | 其他人的框、名字和连线的颜色，按用户分别设置 |
