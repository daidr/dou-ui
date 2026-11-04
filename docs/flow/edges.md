# 连线

连线有三种画法：曲线、折线和直线。连线可以带一段标签，也可以显示成流动的虚线。扩展还能加入新的画法。

<DocDemo src="flow/edges" column />

## 连线类型

`edge.type` 决定一条连线怎么画，不写时用编辑器的 `edgeType` 属性；属性没设时用扩展的 `edgeType`，都没有时用 `bezier`。新画的连线不带 `type`，所以也跟着 `edgeType` 走。下面三种由 `flowKit()` 提供，找不到的类型按 `bezier` 画。

| 类型       | 画法                                                      |
| ---------- | --------------------------------------------------------- |
| `bezier`   | 平滑的曲线，从端口所在的边垂直出发                        |
| `step`     | 直角折线，拐角是 6px 的圆角；目标在起点后面时从外侧绕过去 |
| `straight` | 两个端口之间的直线                                        |

```vue
<DouFlowEditor v-model="doc" edge-type="step" />
```

选中一条两端相对的折线时，中间那一段上会出现一个手柄，拖动它可以左右（端口在上下时是上下）移动这一段。位置存在 `edge.data.bend` 里，是 0 到 1 之间的比例，节点移动后仍然保持。连线有标签时，直接拖动标签就行。拖动中按 `Esc` 取消。

## 标签

`edge.label` 是显示在连线中间的文字。双击连线或它的标签，或者选中连线后按 `Enter`、`F2`，就能直接编辑；右键菜单里也有“编辑标签”。`Enter` 保存，`Esc` 放弃，清空后保存会去掉标签。保存算作一步撤销，读屏会播报“已保存标签”。

## 用键盘选中连线

选中一个节点后按 `E`，会选中它的第一条连线（先是从它出发的，再是连到它的），继续按 `E` 换下一条，`Shift` + `E` 换上一条。读屏会播报这条线连接的两个节点和它的标签，比如“连线：识别文字 → 整理成笔记，标签：直接整理”。选中后可以按 `Enter` 编辑标签，按 `Delete` 删除，按 `Esc` 取消选择。

```ts
import type { FlowEdge } from '@dou-ui/flow'

const edge: FlowEdge = {
  id: 'e2',
  source: { node: 'ocr', port: 'clear' },
  target: { node: 'note', port: 'in' },
  label: '直接整理',
}
```

缩小到 `simpleZoom` 以下时标签不显示，见[大型流程](./performance)。

## 流动的连线

`animated: true` 让连线显示成沿着方向流动的虚线，适合标出正在运行的那一段。系统开启了“减少动态效果”时虚线不动。

```ts
import type { FlowEdge } from '@dou-ui/flow'

const edge: FlowEdge = {
  id: 'e1',
  source: { node: 'photo', port: 'out' },
  target: { node: 'ocr', port: 'in' },
  animated: true,
}
```

## 长连线

[整理](/flow/#控制栏)时，跨过好几层的连线会从中间各层节点的空隙里穿过，不再斜着压过节点。它经过的点存在连线的 `points` 里，内置的三种画法都会经过这些点：曲线在层与层之间转弯、在层内笔直，折线在层间的正中转直角。在编辑器里只挪动这条连线的一端、或改变一端节点的大小（以及用 `FlowTransaction` 的 `moveNode`、`updateNode` 做同样的事）时，`points` 会被清掉，连线恢复成两端直连；两端一起移动时（例如全选拖动、方向键整体移动），`points` 跟着平移。复制粘贴时副本的 `points` 也跟着平移。通过 `v-model` 自己改节点坐标时，要一起清掉 `points`。挪动连线途经的中间节点不会清掉它，节点可能压在线上，再整理一次就好。同一对节点之间的几条长连线（例如从不同端口出发）会错开一格并排走。折叠的分组接管了连线的一端时，这条线不经过 `points`。

经过 `points` 的折线没有中段把手，`data.bend` 不起作用；移动一端清掉 `points` 后恢复。自定义连线类型可以从 `route` 的第三个参数里读到 `edge.points`。

下面的搬家计划先随手摆放，点控制栏里的整理按钮看看效果：“搬运当天”到“入住”的长连线跨过中间一层，从“结清尾款”的旁边绕过去，不再压在节点上。

<DocDemo src="flow/long-edges" />

## 自定义连线类型

用 `defineEdgeType` 声明，放进扩展的 `edgeTypes` 或编辑器的 `edgeTypes` 属性。和节点类型一样，两个扩展定义了同名的类型会报错，包括 `flowKit()` 里的三种；想换掉某个内置类型，用 `edgeTypes` 属性，它会覆盖扩展里的同名类型。`route` 拿到两端的位置和朝向，返回路径和标签的位置，坐标都是画布坐标。画新连线时没有 `edge`。

```ts
import { defineEdgeType, defineFlowExtension } from '@dou-ui/flow'

// 先横着走到一半，再斜着连过去
const elbow = defineEdgeType({
  type: 'elbow',
  route(source, target) {
    const mid = { x: (source.x + target.x) / 2, y: source.y }
    return {
      path: `M${source.x} ${source.y}L${mid.x} ${mid.y}L${target.x} ${target.y}`,
      label: mid,
    }
  },
})

const edges = defineFlowExtension({ name: 'edges', edgeTypes: [elbow] })
```

`route` 还可以返回一个 `handle`：`at` 是手柄的位置，`axis` 是它能移动的方向，`move(point)` 把指针的画布坐标换算成要写进 `edge.data` 的内容。选中连线时编辑器会画出这个手柄，拖动它算作一步撤销。内置的 `bezierEdge`、`stepEdge`、`straightEdge` 也可以直接拿来改。

`route` 返回的 `marks` 是箭头这类附加的笔画：和连线用同一种颜色和粗细，但连线是虚线时它仍然是实线，导出图片时也一样。连线类型的 `style(edge)` 可以按 `edge.data` 给连线加样式，例如虚线；白板的[连接线](./whiteboard#连接线)用这两项实现线型和箭头。

## API

### FlowEdge

| 名称       | 说明                                                                             | 类型                         |
| ---------- | -------------------------------------------------------------------------------- | ---------------------------- |
| `type`     | 连线类型，不写时用编辑器的 `edgeType`                                            | `string`                     |
| `label`    | 连线中间的文字                                                                   | `string`                     |
| `animated` | 显示成沿方向流动的虚线                                                           | `boolean`                    |
| `points`   | 途经的画布坐标，整理时写入；只移动或缩放一端时清掉，两端一起移动或复制时跟着平移 | `{ x: number; y: number }[]` |
| `data`     | 自己的数据；折线把中间一段的位置存在 `data.bend` 里                              | `Record<string, unknown>`    |

### FlowEditor Props

| 名称        | 说明                                                                           | 类型             | 默认值 |
| ----------- | ------------------------------------------------------------------------------ | ---------------- | ------ |
| `edgeType`  | 没写 `type` 的连线用哪种画法，不设时用扩展的 `edgeType`，再没有时用 `'bezier'` | `string`         | —      |
| `edgeTypes` | 扩展之外的连线类型，同名时覆盖扩展里的                                         | `EdgeTypeSpec[]` | —      |

### EdgeTypeSpec

| 名称    | 说明                                                         | 类型                                   |
| ------- | ------------------------------------------------------------ | -------------------------------------- |
| `type`  | 类型名                                                       | `string`                               |
| `route` | 两端之间的路径，`source`、`target` 带有 `x`、`y` 和 `side`   | `(source, target, edge?) => EdgeRoute` |
| `style` | 连线自己的样式，例如 `strokeDasharray`，覆盖端口类型给的样式 | `(edge) => CSSProperties \| undefined` |

### EdgeRoute

| 名称     | 说明                                                       | 类型                                                       |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| `path`   | SVG 路径                                                   | `string`                                                   |
| `label`  | 标签的中心                                                 | `Point`                                                    |
| `handle` | 选中时显示的手柄，拖动它修改 `edge.data`                   | `{ at: Point; axis: 'x' \| 'y'; move: (point) => object }` |
| `marks`  | 用连线的描边画、但永远不画成虚线的部分，例如箭头；SVG 路径 | `string`                                                   |
