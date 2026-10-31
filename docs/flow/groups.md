# 分组

分组是一个可以装下其他节点的框。拖动分组时，里面的节点跟着移动；分组可以调整大小，也可以折叠成只剩标题的一栏。

<DocDemo src="flow/groups" column />

## 放进分组和移出分组

- 选中节点后按 `Ctrl` / `⌘` + `G`，或者在右键菜单里选“放进分组”，会在它们外面画一个新分组。工具栏的“更多”打开的也是这个菜单。
- 把节点拖到分组上松手，它就进了这个分组；拖到分组外松手，它就移出来。拖动时，节点将要进入的分组会高亮。
- 选中分组按 `Ctrl` / `⌘` + `Shift` + `G`，或者在它的右键菜单里选“取消分组”，会去掉这个框，里面的节点留在原处。

分组可以套在另一个分组里。每一次放进、移出和取消都算作一步撤销。

## 在文档里的样子

分组也是一个节点，类型是 `group`。里面的节点用 `parent` 写明它在哪个分组里，坐标仍然是画布上的位置，不是相对分组的位置。所以不认识分组的代码照样能读懂节点在哪里。

```ts
const doc: FlowDocument = {
  nodes: [
    { id: 'collect', type: 'group', x: 0, y: 0, width: 216, height: 196, data: { label: '收集' } },
    { id: 'calendar', parent: 'collect', x: 24, y: 56, data: { label: '本周日程' } },
  ],
  edges: [],
}
```

移动分组时，编辑器在同一个事务里改写它和里面每个节点的 `x`、`y`。`parent` 指向不存在的节点，或者几个节点互相指向成环时，这些 `parent` 会被忽略。

分组的 `data`：

| 名称        | 说明                   | 类型      |
| ----------- | ---------------------- | --------- |
| `label`     | 标题，双击可以直接修改 | `string`  |
| `collapsed` | 是否折叠               | `boolean` |

## 折叠

点标题左边的箭头折叠分组。折叠后只显示标题栏，里面的节点不显示，也不能被选中；连到里面的连线改为连到标题栏上。展开后一切照旧。

## 调整大小

选中分组后，右下角会出现一个手柄，拖动它改变大小，尺寸会对齐网格。分组不会小于 160 × 96。

## 其他操作

- 删除、复制和剪切分组时，里面的节点一起处理。只复制分组里的某个节点时，粘贴出来的副本落在哪个分组里，就属于哪个分组。
- 方向键移动分组时，里面的节点跟着移动。锁定的分组不会移动；锁定的节点跟着它所在的分组移动。
- 整理时，一个分组和它里面的节点当作一整块排列，进出分组的连线算作这个分组的连线。只选中同一个分组里的几个节点时，它们在分组里整理。
- 在分组里按住 `Shift` 拖动会框选，分组只有被完整框住时才会选中。

## 自定义分组

任何节点类型加上 `container: true` 都能装下其他节点。`resizable` 让它有调整大小的手柄，`size` 是新建时的尺寸。

```ts
import { defineNodeType, flowKit, type FlowExtension } from '@dou-ui/flow'

const lane = defineNodeType({
  type: 'lane',
  component: LaneNode,
  container: true,
  resizable: { minWidth: 320, minHeight: 120 },
  size: { width: 640, height: 160 },
})

const extensions: FlowExtension[] = [flowKit(), { name: 'lanes', nodeTypes: [lane] }]
```

`groupNodes(ids, 'lane')` 用这个类型把节点包起来。容器节点的组件和普通节点一样收到 `data`、`updateData` 等属性，`data.collapsed` 为真时编辑器按折叠处理。不需要内置分组时用 `flowKit({ group: false })`。

## 方法

| 名称         | 说明                                                                      | 类型                                                |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `groupNodes` | 把节点（默认是选中的）放进一个新的容器节点，算作一步撤销，返回新节点的 id | `(ids?: string[], type?: string) => string \| null` |
| `ungroup`    | 去掉一个容器节点，里面的节点留下，算作一步撤销                            | `(id: string) => boolean`                           |

扩展里处理分组时，`ctx.tree` 是根据 `parent` 算出的层级（`FlowTree`，有 `parentOf`、`ancestors`、`descendants` 和 `topmost` 方法），`ctx.isContainer(node)` 判断一个节点能不能装下其他节点。
