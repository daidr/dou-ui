# 扩展

扩展把节点类型、端口类型、连接规则、快捷键和画布上的额外图层打包在一起，用 `extensions` 传给编辑器。默认的节点类型本身也是一个扩展，由 `flowKit()` 提供。

下面的例子用一个扩展标记节点：选中节点按 `M` 加上标记，再按一次去掉。标记画在连线下方，跟着画布移动和缩放。

<DocDemo src="flow/extension" column />

## 定义扩展

```ts
import { defineFlowExtension, flowKit } from '@dou-ui/flow'

const marks = defineFlowExtension({
  name: 'marks',
  layers: { below: [MarkRings] },
  keymap: ({ selection, transact }) => ({
    m: () => {
      // ...
    },
  }),
})

const extensions = [flowKit(), marks]
```

不传 `extensions` 时等于 `[flowKit()]`。传了就要自己带上 `flowKit()`，除非不需要默认节点。`node-types` 和 `port-types` 属性仍然可用，同名时它们覆盖扩展里的定义。

扩展的名字、节点类型和端口类型都不能重复，重复时会抛出错误。

## 扩展的字段

| 名称               | 说明                                                                                                                                                        | 类型                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `name`             | 扩展的名字                                                                                                                                                  | `string`                                                    |
| `priority`         | 优先级，越大越先处理按键和连接规则，默认 `100`                                                                                                              | `number`                                                    |
| `nodeTypes`        | 节点类型，见[自定义节点](./custom-nodes)                                                                                                                    | `NodeTypeSpec[]`                                            |
| `portTypes`        | 端口类型，见[端口类型与连接规则](./ports)                                                                                                                   | `PortTypes`                                                 |
| `edgeTypes`        | 连线类型，见[自定义连线类型](./edges#自定义连线类型)                                                                                                        | `EdgeTypeSpec[]`                                            |
| `edgeType`         | 没写 `type` 的连线默认用哪种画法；编辑器的 `edge-type` 属性优先，多个扩展都设了时后面的生效                                                                 | `string`                                                    |
| `canConnect`       | 连接规则，在 `can-connect` 属性之后检查，返回 `false` 或一段说明拒绝                                                                                        | `(connection, doc) => boolean \| string`                    |
| `keymap`           | 画布有焦点时的快捷键，写法和 `useHotkey` 一样；处理函数返回 `false` 表示没处理，交给下一个                                                                  | `(ctx) => Record<string, (event) => boolean \| void>`       |
| `transformPaste`   | 粘贴前改写节点和连线，比如清掉运行状态                                                                                                                      | `(data, ctx) => FlowDocument`                               |
| `layers`           | 画在画布坐标里的组件，`below` 在连线下方，`above` 在节点上方，跟着画布移动和缩放                                                                            | `{ below?: Component[], above?: Component[] }`              |
| `drawLayer`        | 导出图片时画在节点上方的内容，对应 `layers.above`；返回画布坐标下的 SVG 标记，见[导出图片](./export#扩展的图层)                                             | `(ctx, draw: FlowDrawContext, nodes: FlowNode[]) => string` |
| `overlays`         | 浮在编辑器上方的组件，不随画布移动，比如面板；根元素加上 `data-flow-overlay` 后，选中节点的浮动工具栏会避开它；画布里的元素（例如节点上的手柄）加上它也一样 | `Component[]`                                               |
| `contextMenu`      | 右键菜单的项，见[右键菜单](./editing#右键菜单)                                                                                                              | `(ctx, target) => FlowMenuItem[]`                           |
| `toolbarItems`     | 选中节点上方工具栏的按钮，见[工具栏](./editing#工具栏)                                                                                                      | `(ctx, nodes) => FlowToolbarItem[]`                         |
| `edgeToolbarItems` | 只选中连线时工具栏的按钮，见[工具栏](./editing#工具栏)                                                                                                      | `(ctx, edges) => FlowToolbarItem[]`                         |
| `setup`            | 编辑器挂载后调用，可以返回一个函数，在卸载时调用                                                                                                            | `(ctx) => void \| (() => void)`                             |
| `transaction`      | 每次修改生效前按优先级调用，可以继续往里加步骤；撤销和重做也会经过这里                                                                                      | `(tr, ctx) => void`                                         |
| `history`          | 替换编辑器自带的撤销记录，只用第一个提供它的扩展，例如[协同编辑](./collaboration)只撤销自己的修改                                                           | `(ctx) => FlowHistoryHandler`                               |
| `press`            | 在画布或节点上按下时最先询问，按优先级依次调用；返回处理函数就接管这次按下，编辑器不再选中、拖动或平移，例如[白板](./whiteboard)的绘图工具                  | `(ctx, press) => FlowPressHandler \| void`                  |

`ctx` 和组件里 `useFlowEditor()` 拿到的是同一个对象。图层和浮层组件也可以调用 `useFlowEditor()`。

`history` 返回的对象：

```ts
interface FlowHistoryHandler {
  /** 没有可撤销的修改时返回 false */
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}
```

`press` 收到按下的位置（画布坐标）、按下的节点和原始事件，返回的处理函数在指针移动、松开和取消（按 Esc、第二根手指按下）时调用：

```ts
interface FlowPressHandler {
  move?: (point: Point, event: PointerEvent) => void
  end?: (point: Point, event: PointerEvent) => void
  cancel?: () => void
}
```

拖动节点、调整连线和改变分组大小时，编辑器每一帧都会提交一次修改。`ctx.gesturing` 在这期间为 `true`，松手后变回 `false`，需要把一次拖动当作一个修改来处理时（例如同步到服务器）可以等它变回 `false`。正在拉出的连线在 `ctx.connectingPath` 里，是画布坐标下的 SVG 路径，没有在连线时为 `null`。

自己做的手柄如果想松手时才提交一次修改，拖动过程中用 `ctx.previewNode(id, patch)` 把节点显示成改动后的样子，`patch` 可以包含 `x`、`y`、`width`、`height` 和 `data`。节点的外框、端口、连线和 `getNodeRect` 都会跟着变，文档本身不变。白板的缩放和旋转手柄就是这样做的。

```ts
// 拖动中：只改显示
ctx.previewNode(node.id, { data: { ...node.data, rotation } })
// 松手：先恢复，再提交一次
ctx.previewNode(node.id, null)
ctx.transact((tr) => tr.updateData(node.id, { rotation }))
```

- `patch.data` 会整体替换节点的 `data`，不会合并，所以要像上面那样带上原有字段。
- 松手、按 Esc 取消或手柄卸载时都要传 `null` 恢复，否则节点会一直显示成预览的样子。节点从文档里删除时，它的预览会一起丢弃。
- 预览只在本地显示，协作的其他人要等提交后才看到。预览期间文档没有变化，`ctx.gesturing` 保持 `false`。

## 图层组件

图层的坐标就是画布坐标，用 `position: absolute` 和节点的位置摆放即可。`getNodeRect(id)` 返回节点的位置和尺寸，节点移动或改变大小时会更新。

<<< @/examples/flow/mark-rings.vue

图层默认会挡住下面的点击，只用来展示的内容记得加 `pointer-events: none`。

## 快捷键

扩展的快捷键先于编辑器自己的按键处理，多个扩展按 `priority` 从高到低依次询问。处理函数没有返回 `false` 时，按键就算处理过了，编辑器会阻止它的默认行为。

快捷键只在画布或节点有焦点时生效；节点里的输入框有焦点时不会触发。
