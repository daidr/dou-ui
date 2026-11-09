# 文档数据

编辑器的内容是一份普通的 JSON，可以直接保存和读取。节点和连线都有自己的 `id`，连线通过 `id` 引用节点和端口。

```ts
interface FlowDocument {
  version: 1 // 数据格式的版本
  nodes: FlowNode[]
  edges: FlowEdge[]
}
```

<DocDemo src="flow/data" column />

## 节点

```ts
interface FlowNode {
  id: string
  /** 节点类型，不写时为 'default' */
  type?: string
  /** 左上角在画布上的位置，单位 px */
  x: number
  y: number
  /** 只有需要固定尺寸的节点才写，否则由内容决定 */
  width?: number
  height?: number
  /** 节点自己的数据，交给节点类型的组件渲染 */
  data?: Record<string, unknown>
  /** 锁定后不能移动和删除 */
  locked?: boolean
  /** 所在分组的 id，见[分组](./groups) */
  parent?: string
  /** 层级：大的画在上面，不写算 0，一样时按文档里的顺序；分组不参与 */
  z?: number
  /** 这个节点上的讨论 id，见[评论](./comments) */
  comments?: string[]
}
```

## 连线

```ts
interface FlowEdge {
  id: string
  source: { node: string; port?: string }
  target: { node: string; port?: string }
  /** 画法：bezier、step、straight 或扩展加入的类型 */
  type?: string
  label?: string
  animated?: boolean
  /** 途经的点，整理时写入，见连线 */
  points?: { x: number; y: number }[]
  data?: Record<string, unknown>
  /** 这条连线上的讨论 id，见[评论](./comments) */
  comments?: string[]
}
```

不写 `port` 时，连线从源节点右侧中间出发，连到目标节点左侧中间。画法、标签和流动效果见[连线](./edges)。

## 端口

端口由节点类型声明，不存进文档。默认节点从 `data.inputs` 和 `data.outputs` 读取端口：

```ts
interface FlowPortSpec {
  id: string
  /** 输入接收连线，输出发出连线 */
  kind: 'input' | 'output'
  /** 所在的边，输入默认在左，输出默认在右 */
  side?: 'left' | 'right' | 'top' | 'bottom'
  label?: string
  /** 端口传递的数据类型 */
  dataType?: string | string[]
  /** 最多连几条线，输入默认 1，输出不限 */
  max?: number
  /** 显示时机，默认一直显示，见“自定义节点”的“显示时机” */
  visible?: 'always' | 'hover' | 'connecting'
}
```

## 默认节点

没有写 `type` 的节点用默认节点渲染，它读取 `data` 里的这些字段：

| 字段                 | 说明                                   | 类型                                          |
| -------------------- | -------------------------------------- | --------------------------------------------- |
| `label`              | 标题                                   | `string`                                      |
| `description`        | 标题下的说明                           | `string`                                      |
| `icon`               | 标题前的图标，建议用 `markRaw` 包一层  | `Component`                                   |
| `status`             | 右上角的状态点                         | `'pending' \| 'running' \| 'done' \| 'error'` |
| `inputs` / `outputs` | 端口，每个端口一行，输入在左、输出在右 | `{ id, label?, dataType?, max? }[]`           |

只有一个输入和一个输出且都没有名字时，端口放在标题这一行。

## 修改文档

用户的每次操作都会生成一个新的文档对象并通过 `v-model` 更新，原来的对象不会被修改。代码里修改时，可以直接替换 `v-model` 绑定的数据，也可以通过 `transact` 修改，这样修改会进入撤销记录：

```ts
editor.value?.transact((tr) => {
  tr.addNode({ id: 'c', x: 600, y: 0, data: { label: '发布' } })
  tr.addEdge({ id: 'e2', source: { node: 'b' }, target: { node: 'c' } })
  tr.updateData('a', { status: 'done' })
})
```

事务提供 `addNode`、`removeNode`（连同它的连线）、`updateNode`、`moveNode`、`updateData`、`addEdge`、`removeEdge`、`updateEdge`。`transaction` 事件会带上这个事务，里面的 `steps` 是这次修改的全部步骤，`inverse` 是撤销它的步骤。

## 检查与迁移

文档里的 `version` 是数据格式的版本，目前是 `1`。保存或打开一份文档之前，可以先检查：

```ts
import { checkDocument, migrateDocument } from '@dou-ui/flow'

const doc = migrateDocument(JSON.parse(saved))
const problems = checkDocument(doc, { extensions, nodeTypes })
```

`checkDocument` 找出版本不对、节点或连线缺少 `id` 或 `id` 重复、坐标不是数字、连线的两端指向不存在的节点、`parent` 指向不存在的分组或绕成一圈，每一项带 `code`、`path`（如 `edges[0].target`）和出问题的 `nodeId` 或 `edgeId`。传入和编辑器一样的 `extensions`、`nodeTypes`、`edgeTypes` 时，还会检查没有注册的节点类型、连线类型，以及连线用到了节点没有的端口；只传 `nodeTypes` 或 `edgeTypes` 时，和编辑器一样按默认的 `flowKit()` 算。整份数据的形状不对（不是对象，或者列表不是数组）时只报 `shape`，先修好形状才能检查别的。`migrateDocument` 补全旧文档或手写文档缺少的部分（`version`、`nodes`、`edges`），丢掉不是对象的节点和连线；传入的不是对象（包括数组和 `null`），或者版本不认识时报错，以免把损坏的存档当成空文档再保存回去。还没有存档时用 `emptyDocument()` 新建。

`version` 的类型是字面量 `1`，在 TypeScript 里手写文档时给 `ref` 标上 `FlowDocument` 类型，或写成 `version: 1 as const`。`v-model` 的形状不对（缺少 `nodes`、`edges` 或 `version`）时，编辑器把缺少的部分当成空的，并在开发环境下给出警告；写回的文档总是带 `version: 1`。
