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

## 节点里的控件

输入框、按钮、链接等控件可以正常操作，不会触发节点拖动。其他元素也可以加上 `data-flow-nodrag` 属性，让在它上面按下时不拖动节点。

## defineNodeType

| 名称        | 说明                                  | 类型                                         |
| ----------- | ------------------------------------- | -------------------------------------------- |
| `type`      | 类型名，对应节点的 `type`             | `string`                                     |
| `component` | 渲染节点内容的组件                    | `Component`                                  |
| `ports`     | 端口，固定的列表，或根据节点算出      | `FlowPortSpec[] \| (node) => FlowPortSpec[]` |
| `defaults`  | 新节点的默认数据                      | `() => object`                               |
| `label`     | 节点的无障碍名称，默认取 `data.label` | `(node) => string`                           |
