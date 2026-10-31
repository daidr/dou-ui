# 自定义节点

用 `defineNodeType` 声明节点类型，再通过 `node-types` 传给编辑器。节点的外框、选中态和焦点框由编辑器画，组件只负责里面的内容。

<DocDemo src="flow/custom-node" column />

```ts
import { defineNodeType } from '@dou-ui/flow'
import PromptNode from './prompt-node.vue'

const promptNode = defineNodeType({
  type: 'prompt',
  component: PromptNode,
  ports: [{ id: 'text', kind: 'output' }],
  label: (node) => node.data.title,
})
```

节点组件：

<<< @/examples/flow/prompt-node.vue

## 节点组件收到的属性

| 名称         | 说明                                        | 类型              |
| ------------ | ------------------------------------------- | ----------------- |
| `node`       | 节点本身                                    | `FlowNode`        |
| `data`       | 节点的数据，等于 `node.data`                | `object`          |
| `ports`      | 这个节点的端口                              | `FlowPortSpec[]`  |
| `selected`   | 是否选中                                    | `boolean`         |
| `readonly`   | 编辑器是否只读                              | `boolean`         |
| `updateData` | 把修改合并进 `data`，连续的修改算作一步撤销 | `(patch) => void` |

## 放置端口

在组件里用 `<DouFlowPort id="..." />` 放端口。端口会贴在最近的定位祖先（`position: relative`）的边上，并在垂直方向居中，所以把它放进一个横跨整个节点宽度的行里，就能让端口和这一行对齐。

组件没有放置的端口，编辑器会沿着它所在的边均匀排开。

## 节点里的表单

节点里可以放任何表单组件。输入框、选择器、开关、按钮、链接等控件可以正常操作，不会触发节点拖动；其他元素可以加上 `data-dou-nodrag` 属性，在它上面按下时同样不拖动节点。画布和节点上的文字默认不能选中，拖动时不会误选；想让节点里的某段文字（比如运行结果）可以选中复制，给它加上 `data-dou-nodrag` 和 `user-select: text`。节点里能滚动的区域会自己处理滚轮，滚到头之后才平移画布。

把组件的值绑定到 `data`，修改时调用 `updateData`，修改就会进入文档和撤销记录。

<DocDemo src="flow/form" column />

<<< @/examples/flow/form-node.vue

## defineNodeType

| 名称        | 说明                                                                                              | 类型                                         |
| ----------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `type`      | 类型名，对应节点的 `type`                                                                         | `string`                                     |
| `component` | 渲染节点内容的组件                                                                                | `Component`                                  |
| `ports`     | 端口，固定的列表，或根据节点算出                                                                  | `FlowPortSpec[] \| (node) => FlowPortSpec[]` |
| `defaults`  | 新节点的默认数据                                                                                  | `() => object`                               |
| `label`     | 节点的无障碍名称，默认取 `data.label`；`messages` 是编辑器当前语言的文案                          | `(node, messages) => string`                 |
| `container` | 能装下其他节点，见[自定义分组](./groups#自定义分组)                                               | `boolean`                                    |
| `resizable` | 选中时显示调整大小的手柄，可以给出最小尺寸；写成函数时按节点决定，返回 `false` 不显示             | `NodeResize \| (node) => NodeResize`         |
| `size`      | 新建时的宽高                                                                                      | `{ width: number, height: number }`          |
| `frame`     | 设为 `false` 时编辑器不画卡片（边框、底色、阴影），由组件自己画外形，例如圆形；选中时显示一圈细框 | `boolean`                                    |
| `bounds`    | 节点画到自身方框外时（例如旋转后）在屏幕上占的范围，选中节点上方的工具栏按它定位                  | `(node, rect) => Rect`                       |
| `draw`      | 导出图片时把节点画成 SVG，见[导出图片](./export#自定义节点)；不写时画成带名称和端口的卡片         | `(node, draw: FlowDrawContext) => string`    |
