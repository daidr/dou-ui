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

| 名称             | 说明                                                                                       | 类型                                                  |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `name`           | 扩展的名字                                                                                 | `string`                                              |
| `priority`       | 优先级，越大越先处理按键和连接规则，默认 `100`                                             | `number`                                              |
| `nodeTypes`      | 节点类型，见[自定义节点](./custom-nodes)                                                   | `NodeTypeSpec[]`                                      |
| `portTypes`      | 端口类型，见[端口类型与连接规则](./ports)                                                  | `PortTypes`                                           |
| `edgeTypes`      | 连线类型，见[自定义连线类型](./edges#自定义连线类型)                                       | `EdgeTypeSpec[]`                                      |
| `canConnect`     | 连接规则，在 `can-connect` 属性之后检查，返回 `false` 或一段说明拒绝                       | `(connection, doc) => boolean \| string`              |
| `keymap`         | 画布有焦点时的快捷键，写法和 `useHotkey` 一样；处理函数返回 `false` 表示没处理，交给下一个 | `(ctx) => Record<string, (event) => boolean \| void>` |
| `transformPaste` | 粘贴前改写节点和连线，比如清掉运行状态                                                     | `(data, ctx) => FlowDocument`                         |
| `layers`         | 画在画布坐标里的组件，`below` 在连线下方，`above` 在节点上方，跟着画布移动和缩放           | `{ below?: Component[], above?: Component[] }`        |
| `overlays`       | 浮在编辑器上方的组件，不随画布移动，比如面板                                               | `Component[]`                                         |
| `contextMenu`    | 右键菜单的项，见[右键菜单](./editing#右键菜单)                                             | `(ctx, target) => FlowMenuItem[]`                     |
| `toolbarItems`   | 选中节点上方工具栏的按钮，见[工具栏](./editing#工具栏)                                     | `(ctx, nodes) => FlowToolbarItem[]`                   |

`ctx` 和组件里 `useFlowEditor()` 拿到的是同一个对象。图层和浮层组件也可以调用 `useFlowEditor()`。

## 图层组件

图层的坐标就是画布坐标，用 `position: absolute` 和节点的位置摆放即可。`getNodeRect(id)` 返回节点的位置和尺寸，节点移动或改变大小时会更新。

<<< @/examples/flow/mark-rings.vue

图层默认会挡住下面的点击，只用来展示的内容记得加 `pointer-events: none`。

## 快捷键

扩展的快捷键先于编辑器自己的按键处理，多个扩展按 `priority` 从高到低依次询问。处理函数没有返回 `false` 时，按键就算处理过了，编辑器会阻止它的默认行为。

快捷键只在画布或节点有焦点时生效；节点里的输入框有焦点时不会触发。
