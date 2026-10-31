# 连线

连线有三种画法：曲线、折线和直线。连线可以带一段标签，也可以显示成流动的虚线。扩展还能加入新的画法。

<DocDemo src="flow/edges" column />

## 连线类型

`edge.type` 决定一条连线怎么画，不写时用编辑器的 `edge-type` 属性，默认是 `bezier`。新画的连线不带 `type`，所以也跟着 `edge-type` 走。下面三种由 `flowKit()` 提供，找不到的类型按 `bezier` 画。

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
{ id: 'e2', source: { node: 'ocr', port: 'clear' }, target: { node: 'note', port: 'in' }, label: '直接整理' }
```

缩小到 `simple-zoom` 以下时标签不显示，见[大型流程](./performance)。

## 流动的连线

`animated: true` 让连线显示成沿着方向流动的虚线，适合标出正在运行的那一段。系统开启了“减少动态效果”时虚线不动。

```ts
{ id: 'e1', source: { node: 'photo', port: 'out' }, target: { node: 'ocr', port: 'in' }, animated: true }
```

## 自定义连线类型

用 `defineEdgeType` 声明，放进扩展的 `edgeTypes` 或编辑器的 `edge-types` 属性。和节点类型一样，两个扩展定义了同名的类型会报错，包括 `flowKit()` 里的三种；想换掉某个内置类型，用 `edge-types` 属性，它会覆盖扩展里的同名类型。`route` 拿到两端的位置和朝向，返回路径和标签的位置，坐标都是画布坐标。画新连线时没有 `edge`。

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

`route` 还可以返回一个 `handle`：`at` 是手柄的位置，`axis` 是它能移动的方向，`move(point)` 把指针的画布坐标换算成要写进 `edge.data` 的内容。选中连线时编辑器会画出这个手柄，拖动它就是一步撤销。内置的 `bezierEdge`、`stepEdge`、`straightEdge` 也可以直接拿来改。

## API

### FlowEdge

| 名称       | 说明                                                | 类型                      |
| ---------- | --------------------------------------------------- | ------------------------- |
| `type`     | 连线类型，不写时用编辑器的 `edge-type`              | `string`                  |
| `label`    | 连线中间的文字                                      | `string`                  |
| `animated` | 显示成沿方向流动的虚线                              | `boolean`                 |
| `data`     | 自己的数据；折线把中间一段的位置存在 `data.bend` 里 | `Record<string, unknown>` |

### FlowEditor 属性

| 名称         | 说明                                   | 类型             | 默认值     |
| ------------ | -------------------------------------- | ---------------- | ---------- |
| `edge-type`  | 没写 `type` 的连线用哪种画法           | `string`         | `'bezier'` |
| `edge-types` | 扩展之外的连线类型，同名时覆盖扩展里的 | `EdgeTypeSpec[]` | —          |

### EdgeTypeSpec

| 名称    | 说明                                                       | 类型                                   |
| ------- | ---------------------------------------------------------- | -------------------------------------- |
| `type`  | 类型名                                                     | `string`                               |
| `route` | 两端之间的路径，`source`、`target` 带有 `x`、`y` 和 `side` | `(source, target, edge?) => EdgeRoute` |

### EdgeRoute

| 名称     | 说明                                     | 类型                                                       |
| -------- | ---------------------------------------- | ---------------------------------------------------------- |
| `path`   | SVG 路径                                 | `string`                                                   |
| `label`  | 标签的中心                               | `Point`                                                    |
| `handle` | 选中时显示的手柄，拖动它修改 `edge.data` | `{ at: Point; axis: 'x' \| 'y'; move: (point) => object }` |
