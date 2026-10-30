# 流程编辑器

`@dou-ui/flow` 提供流程编辑器 `DouFlowEditor`：在一块可以平移、缩放的画布上摆放节点，节点之间用连线连接。适合编辑 AI 工作流、数据处理流程、自动化规则这类"节点 + 端口 + 连线"的图。

编辑器只负责编辑和展示，不负责运行流程。节点的运行状态由你写进数据，编辑器负责画出来。

只需要展示、不需要编辑时，用 `dou-ui` 里的 [NodeGraph](/components/node-graph) 就够了，它会自动排好节点的位置。

## 安装

流程编辑器是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/flow
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/flow/style.css'
import { DouFlowEditor } from '@dou-ui/flow'

app.use(DouFlowEditor)
```

也可以只在用到的组件里 `import { DouFlowEditor } from '@dou-ui/flow'`。

## 基础用法

`v-model` 绑定一份包含节点和连线的数据，格式见[文档数据](./data)。`fit-view` 让画布在节点测量完成后缩放到能看到全部节点。

<DocDemo src="flow/basic" column />

- 拖动节点移动它。拖动时会和附近的节点对齐（出现参考线），连着的端口会吸附到同一高度，让连线变成直线；没有可对齐的对象时吸附到 8px 网格。按住 `Alt` 拖动可以暂时关闭吸附。
- 拖动画布空白处平移，滚轮也可以平移，`Shift` + 滚轮横向平移。`Ctrl` / `⌘` + 滚轮或触控板捏合缩放。
- 点击选中节点或连线，`Shift` 点击加选。按住 `Shift` 在空白处拖动可以框选。
- `Delete` 删除选中的节点和连线，删除节点时连在它上面的连线一起删除。
- `Ctrl` / `⌘` + `Z` 撤销，`Ctrl` / `⌘` + `Shift` + `Z` 重做。一次拖动、连续按方向键都只算一步。

### 连线

- 从输出端口拖出连线，松开在输入端口上完成连接。靠近端口时会自动吸附，松开在节点的任意位置也会连到它最近的可用端口。
- 拖动时能连的端口会高亮，不能连的变淡。哪些端口能连由[端口类型与连接规则](./ports)决定，不设置时输出可以连到任何输入。
- 输入端口默认只接一条线，连到已有连线的输入时会替换原来的连线。
- 从已有连线的输入端口拖动，可以把这条线改接到别的端口；拖到空白处松开会删除它。
- 新连线拖到空白处松开时触发 `connect-end`，可以在这里弹出节点列表，创建节点后再连上。
- 选中一个节点后按 `C` 用键盘连线：方向键在能连的端口之间切换，`Tab` 换一个起点端口，`Enter` 确认，`Esc` 取消。

### 复制和粘贴

`Ctrl` / `⌘` + `C` 复制选中的节点和它们之间的连线，`Ctrl` / `⌘` + `V` 粘贴到指针所在的位置（指针不在画布上时粘贴在原位置旁边），`Ctrl` / `⌘` + `X` 剪切，`Ctrl` / `⌘` + `D` 复制一份。同一页面上的多个编辑器之间也可以互相粘贴。

### 触屏

- 单指拖动空白处平移，双指捏合缩放。
- 单指拖动节点移动它。
- 长按空白处后拖动框选，长按节点把它加入选择。

### 键盘

| 按键                           | 作用                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- |
| `Tab` / `Shift` + `Tab`        | 按从上到下、从左到右的顺序在节点之间切换，并选中它                        |
| 方向键                         | 移动选中的节点一格（`grid`），加 `Shift` 移动四格；没有选中节点时平移画布 |
| `Delete` / `Backspace`         | 删除选中的节点和连线                                                      |
| `Esc`                          | 拖动中按下时取消这次拖动，否则清除选择                                    |
| `Ctrl` / `⌘` + `A`             | 选中全部节点                                                              |
| `Ctrl` / `⌘` + `=` / `-` / `0` | 放大、缩小、恢复 100%                                                     |
| 按住空格拖动                   | 平移画布                                                                  |

## 控制栏

`DouFlowControls` 放在编辑器的默认插槽里，提供撤销、重做、缩放和适应画布。`placement` 决定它在哪个角，`:history="false"` 隐藏撤销和重做。

默认插槽里的内容浮在画布上方，不会触发画布的拖动和缩放。自己写的面板可以用 `useFlowEditor()` 拿到编辑器的状态和方法。

## 只读

`readonly` 时节点不能移动和删除，仍然可以选中、平移和缩放。

## API

### FlowEditor 属性

| 名称                    | 说明                                             | 类型                    | 默认值                     |
| ----------------------- | ------------------------------------------------ | ----------------------- | -------------------------- |
| `v-model`               | 文档数据                                         | `FlowDocument`          | `{ nodes: [], edges: [] }` |
| `v-model:selection`     | 选中的节点和连线                                 | `FlowSelection`         | `{ nodes: [], edges: [] }` |
| `v-model:viewport`      | 画布的位置和缩放                                 | `FlowViewport`          | `{ x: 0, y: 0, zoom: 1 }`  |
| `node-types`            | 节点类型，见[自定义节点](./custom-nodes)         | `NodeTypeSpec[]`        | —                          |
| `grid`                  | 吸附网格和方向键的步长，`0` 关闭网格吸附         | `number`                | `8`                        |
| `guides`                | 拖动时与其他节点对齐、端口吸附                   | `boolean`               | `true`                     |
| `min-zoom` / `max-zoom` | 缩放范围                                         | `number`                | `0.1` / `4`                |
| `fit-view`              | 节点测量完成后缩放到能看到全部节点               | `boolean`               | `false`                    |
| `readonly`              | 只读                                             | `boolean`               | `false`                    |
| `pan-on-scroll`         | 滚轮平移画布；关闭后只有 `Ctrl` / `⌘` + 滚轮缩放 | `boolean`               | `true`                     |
| `label`                 | 画布的无障碍名称                                 | `string`                | —                          |
| `messages`              | 覆盖编辑器的文案                                 | `Partial<FlowMessages>` | —                          |

### FlowEditor 事件

| 名称                                                | 说明                                     | 参数                |
| --------------------------------------------------- | ---------------------------------------- | ------------------- |
| `change`                                            | 文档改变后触发，包括撤销和重做           | `(tr: Transaction)` |
| `node-click` / `node-dblclick` / `node-contextmenu` | 点击、双击、右键节点                     | `(node, event)`     |
| `edge-click` / `edge-contextmenu`                   | 点击、右键连线                           | `(edge, event)`     |
| `canvas-click` / `canvas-contextmenu`               | 点击、右键画布空白处，`point` 是画布坐标 | `(point, event)`    |

### FlowEditor 方法

| 名称                            | 说明                               | 类型                                       |
| ------------------------------- | ---------------------------------- | ------------------------------------------ |
| `transact`                      | 在一个事务里修改文档，算作一步撤销 | `(fn: (tr) => void, meta?) => Transaction` |
| `undo` / `redo`                 | 撤销、重做                         | `() => boolean`                            |
| `canUndo` / `canRedo`           | 能否撤销、重做                     | `boolean`                                  |
| `fit`                           | 显示全部节点，或指定的节点         | `(ids?: string[]) => void`                 |
| `zoomTo` / `zoomIn` / `zoomOut` | 缩放                               | —                                          |
| `centerNode`                    | 把节点移到画布中央，不改变缩放     | `(id: string) => void`                     |
| `toCanvas`                      | 屏幕坐标转画布坐标                 | `(point: Point) => Point`                  |
| `getNodeRect`                   | 节点在画布上的位置和尺寸           | `(id: string) => Rect \| null`             |

### FlowControls 属性

| 名称        | 说明           | 类型                                                           | 默认值          |
| ----------- | -------------- | -------------------------------------------------------------- | --------------- |
| `placement` | 所在的角       | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | `'bottom-left'` |
| `history`   | 显示撤销和重做 | `boolean`                                                      | `true`          |
