# 流程编辑器

`@dou-ui/flow` 提供流程编辑器 `DouFlowEditor`：在一块可以平移、缩放的画布上摆放节点，节点之间用连线连接。适合编辑 AI 工作流、数据处理流程、自动化规则这类“节点 + 端口 + 连线”的图。

编辑器只负责编辑和展示，不负责运行流程。节点的运行状态由你写进数据，编辑器负责画出来。完整的例子见区块 [AI 工作流](/blocks/ai-workflow)。

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

`v-model` 绑定一份包含节点和连线的数据，格式见[文档数据](./data)。`fitView` 让画布在节点测量完成后缩放到能看到全部节点；为了字还看得清，最多缩小到 `fitMinZoom`（默认 50%），再放不下时从左上角开始显示，可以平移查看。

<DocDemo src="flow/basic" column />

- 拖动节点移动它。拖动时会和附近的节点对齐（出现参考线），连着的端口会吸附到同一高度，让连线变成直线；没有可对齐的对象时吸附到 8px 网格。按住 `Alt` 拖动可以暂时关闭吸附。
- 拖动画布空白处平移，滚轮也可以平移，`Shift` + 滚轮横向平移。`Ctrl` / `⌘` + 滚轮或触控板捏合缩放。
- 平移最远到节点刚好移出视野，留出一屏空白画布，不会离节点越来越远。通过 `v-model:viewport` 设置的位置不受这个限制。
- 点击选中节点或连线，`Shift` 点击加选。按住 `Shift` 在空白处拖动可以框选。
- `Delete` 删除选中的节点和连线，删除节点时连在它上面的连线一起删除。
- `Ctrl` / `⌘` + `Z` 撤销，`Ctrl` / `⌘` + `Shift` + `Z` 重做。一次拖动、连续按方向键都只算一步。

### 连线

- 从输出端口拖出连线，松开在输入端口上完成连接。靠近端口时会自动吸附，松开在节点的任意位置也会连到它最近的可用端口。
- 拖动时能连的端口会高亮，不能连的变淡；指针停在不能连的端口上时，端口和连线变红，松开后读屏会说明原因。哪些端口能连由[端口类型与连接规则](./ports)决定，不设置时输出可以连到任何输入。
- 输入端口默认只接一条线，连到已有连线的输入时会替换原来的连线。
- 从已有连线的输入端口拖动，可以把这条线改接到别的端口；拖到空白处松开会删除它。
- 新连线拖到空白处松开时触发 `connectToCanvas`，可以在这里弹出节点列表，创建节点后再连上。
- 选中一个节点后按 `C` 用键盘连线：方向键在能连的端口之间切换，`Tab` 换一个起点端口，`Enter` 确认，`Esc` 取消。

### 复制和粘贴

`Ctrl` / `⌘` + `C` 复制选中的节点和它们之间的连线，`Ctrl` / `⌘` + `V` 粘贴到指针所在的位置（指针不在画布上时粘贴在原位置旁边），`Ctrl` / `⌘` + `X` 剪切，`Ctrl` / `⌘` + `D` 复制一份。

复制的内容以 JSON 写进系统剪贴板，所以可以粘贴到另一个标签页的编辑器里，也可以贴到文本框里查看。

### 触屏

- 单指拖动空白处平移，双指捏合缩放。
- 单指拖动节点移动它。
- 长按空白处后拖动框选，长按节点把它加入选择。
- 查找没有手势，需要时自己放一个按钮调用 `openSearch()`，见[查找节点](#查找节点)。

### 键盘

| 按键                                 | 作用                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `Tab` / `Shift` + `Tab`              | 沿连线的方向在节点之间切换并选中它，同一层的节点从左到右                  |
| 方向键                               | 移动选中的节点一格（`grid`），加 `Shift` 移动四格；没有选中节点时平移画布 |
| `Alt` + 方向键                       | 调整选中分组的大小，见[分组](./groups#调整大小)                           |
| `Delete` / `Backspace`               | 删除选中的节点和连线                                                      |
| `C`                                  | 从选中的节点开始连线                                                      |
| `E` / `Shift` + `E`                  | 在选中节点的连线之间切换，见[用键盘选中连线](./edges#用键盘选中连线)      |
| `Enter` / `F2`                       | 编辑选中连线的标签                                                        |
| `Esc`                                | 拖动中按下时取消这次拖动；查找面板开着时关闭它；否则清除选择              |
| `Ctrl` / `⌘` + `A`                   | 选中全部节点                                                              |
| `Ctrl` / `⌘` + `C` / `X` / `V` / `D` | 复制、剪切、粘贴、复制一份                                                |
| `Ctrl` / `⌘` + `G`                   | 把选中的节点放进分组，加 `Shift` 取消分组或移出分组，见[分组](./groups)   |
| `Ctrl` / `⌘` + `=` / `-` / `0`       | 放大、缩小、恢复 100%                                                     |
| `Ctrl` / `⌘` + `F`                   | 按名字查找节点，见[查找节点](#查找节点)                                   |
| `F3` / `Shift` + `F3`                | 下一个、上一个查找结果                                                    |
| 按住空格拖动                         | 平移画布                                                                  |

## 查找节点

节点多的时候，按 `Ctrl` / `⌘` + `F` 在画布右上角打开查找框，按节点显示的名字查找（白板里是形状和便签上的文字）。右上角已有工具栏、控制条之类的面板时，查找框排在它们下面。找到的节点套上一圈底色，当前这一个会被选中并移到画布中央，缩放不变；`Enter` / `Shift` + `Enter` 或 `F3` / `Shift` + `F3` 在结果之间按阅读顺序前后移动，`Esc` 关闭。流程图只查找，没有替换。

其他编辑器的下一个结果还可以用 `Ctrl` / `⌘` + `G`，流程图里这个键已经用来分组，所以只有 `F3`。

- `openSearch({ search: '质检' })` 打开查找框并填好查询。触屏设备上没有快捷键，可以像下面的示例一样放一个按钮调用它；`closeSearch()` 关闭查找框。
- 只要结果时用 `findNodes({ search })`，它只返回匹配的节点 id，可以自己决定怎么展示。查询的类型是 `FlowSearchQuery`（`search` 和 `caseSensitive`）。
- 应用有自己的全局搜索时，把 `searchable` 设为 `false`，`Ctrl` / `⌘` + `F` 就留给页面。

面板上的文字在 [ConfigProvider](../components/config-provider) 语言包的 `findReplace` 里。

<DocDemo src="flow/find" column />

## 控制栏

`DouFlowControls` 放在编辑器的默认插槽里，提供撤销、重做、缩放、适应画布和整理。`placement` 决定它在哪个角，`:history="false"` 隐藏撤销和重做，`:tidy="false"` 隐藏整理。

“整理”沿连线按 `direction` 把节点一层一层排开：选中了两个以上的节点时只整理它们，否则整理全部。整理后节点群的左上角不动，锁定的节点不动，整个过程算作一步撤销，读屏会播报整理了几个节点；排好后超出视野时会缩放到能看到它们。也可以调用 `tidy()` 方法。

## 小地图

`DouFlowMinimap` 也放在默认插槽里，画出全部节点和当前看到的范围。点击或拖动小地图可以移动画布，拖到小地图外面时视图停在边上。流程比画布大很多时才需要它。

<DocDemo src="flow/minimap" column />

适应画布和 `fitView` 会给四角的面板留出位置，节点不会被控制栏或小地图挡住。

## 只读

`readonly` 时节点不能移动和删除，仍然可以选中、平移和缩放。

## API

### FlowEditor Props

| 名称                  | 说明                                                                                                        | 类型                                     | 默认值                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------- |
| `v-model`             | 文档数据                                                                                                    | `FlowDocument`                           | `{ version: 1, nodes: [], edges: [] }` |
| `v-model:selection`   | 选中的节点和连线                                                                                            | `FlowSelection`                          | `{ nodes: [], edges: [] }`             |
| `v-model:viewport`    | 画布的位置和缩放                                                                                            | `FlowViewport`                           | `{ x: 0, y: 0, zoom: 1 }`              |
| `extensions`          | 扩展，见[扩展](./extensions)                                                                                | `(FlowExtension \| FlowExtension[])[]`   | `[flowKit()]`                          |
| `nodeTypes`           | 节点类型，见[自定义节点](./custom-nodes)                                                                    | `NodeTypeSpec[]`                         | —                                      |
| `grid`                | 吸附网格和方向键的步长，`0` 关闭网格吸附                                                                    | `number`                                 | `8`                                    |
| `guides`              | 拖动时与其他节点对齐、端口吸附                                                                              | `boolean`                                | `true`                                 |
| `minZoom` / `maxZoom` | 缩放范围                                                                                                    | `number`                                 | `0.1` / `4`                            |
| `direction`           | 流程的方向，“整理”按它排列：`horizontal` 从左到右，`vertical` 从上到下                                      | `'horizontal' \| 'vertical'`             | `'horizontal'`                         |
| `fitView`             | 节点测量完成后缩放到能看到全部节点                                                                          | `boolean`                                | `false`                                |
| `fitMinZoom`          | `fitView` 最多缩小到多少，`0` 表示总是显示全部                                                              | `number`                                 | `0.5`                                  |
| `edgeType`            | 没写 `type` 的连线用哪种画法，不设时用扩展的 `edgeType`，见[连线](./edges)                                  | `string`                                 | —                                      |
| `edgeTypes`           | 扩展之外的连线类型                                                                                          | `EdgeTypeSpec[]`                         | —                                      |
| `simpleZoom`          | 低于这个缩放比例时只画节点的外框和名字，见[大型流程](./performance)                                         | `number`                                 | `0.4`                                  |
| `portTypes`           | 端口类型的外观和连接规则，见[端口类型与连接规则](./ports)                                                   | `PortTypes`                              | —                                      |
| `acyclic`             | 不允许连出环                                                                                                | `boolean`                                | `false`                                |
| `canConnect`          | 连线前的最后一道检查，返回 `false` 或一段说明拒绝                                                           | `(connection, doc) => boolean \| string` | —                                      |
| `searchable`          | 内置的查找框（`Ctrl` / `⌘` + `F`），关闭后按键留给页面，见[查找节点](#查找节点)                             | `boolean`                                | `true`                                 |
| `readonly`            | 只读                                                                                                        | `boolean`                                | `false`                                |
| `bordered`            | 外框和圆角；关闭后去掉外框和圆角，用于放进已有边框的容器，见[去掉外框](/guide/theming#去掉外框与调整内边距) | `boolean`                                | `true`                                 |
| `panOnScroll`         | 滚轮平移画布；关闭后只有 `Ctrl` / `⌘` + 滚轮缩放                                                            | `boolean`                                | `true`                                 |
| `ariaLabel`           | 画布的无障碍名称                                                                                            | `string`                                 | —                                      |
| `messages`            | 覆盖编辑器的文案，只需写要改的部分                                                                          | `FlowMessagesOverride`                   | —                                      |

### CSS 变量

| 名称                       | 说明     | 默认值                    |
| -------------------------- | -------- | ------------------------- |
| `--dou-flow-editor-border` | 外框颜色 | `var(--dou-color-border)` |

### FlowEditor Events

| 名称                                             | 说明                                                                                                                          | 参数                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `transaction`                                    | 每次修改文档时触发，包括撤销和重做，参数里有这次修改的每一步；要整份文档用 `v-model`                                          | `(tr: FlowTransaction)` |
| `transactionCancel`                              | 扩展取消了一次修改，`tr.cancelReason` 是原因，见[取消修改](./extensions#取消修改)                                             | `(tr: FlowTransaction)` |
| `nodeClick` / `nodeDblclick` / `nodeContextmenu` | 点击、双击、右键节点                                                                                                          | `(node, event)`         |
| `edgeClick` / `edgeContextmenu`                  | 点击、右键连线                                                                                                                | `(edge, event)`         |
| `canvasClick` / `canvasContextmenu`              | 点击、右键画布空白处，`point` 是画布坐标；右键事件里 `event.preventDefault()` 不打开内置菜单                                  | `(point, event)`        |
| `connect`                                        | 连好一条线，包括改接                                                                                                          | `(edge)`                |
| `connectToCanvas`                                | 新连线拖到空白处松开，`from` 是起点端口，`point` 是画布坐标；`event.preventDefault()` 不弹出节点列表，见[编辑交互](./editing) | `(from, point, event)`  |

### FlowEditor Exposes

| 名称                  | 说明                                                                           | 类型                                                            |
| --------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `transact`            | 在一个事务里修改文档，算作一步撤销                                             | `(fn: (tr) => void, meta?) => FlowTransaction`                  |
| `undo` / `redo`       | 撤销、重做                                                                     | `() => boolean`                                                 |
| `canUndo` / `canRedo` | 能否撤销、重做                                                                 | `boolean`                                                       |
| `fit`                 | 显示全部节点，或指定的节点                                                     | `(ids?: string[]) => void`                                      |
| `zoomTo`              | 缩放到给定的比例                                                               | `(zoom: number) => void`                                        |
| `zoomIn` / `zoomOut`  | 放大、缩小一档                                                                 | `() => void`                                                    |
| `centerNode`          | 把节点移到画布中央，不改变缩放                                                 | `(id: string) => void`                                          |
| `openSearch`          | 打开查找框，可以填好查询；`searchable` 关闭时返回 `false`                      | `(query?: Partial<FlowSearchQuery>) => boolean`                 |
| `closeSearch`         | 关闭查找框，没有打开时返回 `false`                                             | `() => boolean`                                                 |
| `findNodes`           | 名字包含查找文字的节点 id，按阅读顺序                                          | `(query: FlowSearchQuery) => string[]`                          |
| `setViewport`         | 移动视图，和用户平移一样最远到节点刚好移出视野；`animate` 为 `true` 时动画过渡 | `(viewport: FlowViewport, animate?: boolean) => void`           |
| `tidy`                | 整理节点，默认整理选中的（两个以上时）或全部，算作一步撤销                     | `(ids?: string[]) => void`                                      |
| `toCanvas`            | 屏幕坐标转画布坐标                                                             | `(point: Point) => Point`                                       |
| `getNodeRect`         | 节点在画布上的位置和尺寸                                                       | `(id: string) => Rect \| null`                                  |
| `exportSVG`           | 把流程导出成 SVG 文本，见[导出图片](./export)                                  | `(options?: FlowExportOptions) => string`                       |
| `exportPNG`           | 把流程导出成 PNG，见[导出图片](./export)                                       | `(options?: FlowImageOptions) => Promise<Blob>`                 |
| `staleEdges`          | 端口已经对不上的连线，见[端口类型随数据变化](./ports#端口类型随数据变化)       | `string[]`                                                      |
| `removeStaleEdges`    | 删除这些连线，算作一步撤销，返回删除的条数                                     | `() => number`                                                  |
| `insertNode`          | 新建一个节点并选中，见[用代码添加节点](./editing#用代码添加节点)               | `(type: string, options?: FlowInsertOptions) => string \| null` |
| `startInsertDrag`     | 从一次 `pointerdown` 开始拖入新节点，见[拖入节点](./editing#拖入节点)          | `(type: string, event: PointerEvent) => boolean`                |
| `paletteTypes`        | 写了 `palette` 的节点类型，按顺序，见[拖入节点](./editing#拖入节点)            | `NodeTypeSpec[]`                                                |
| `editLabel`           | 选中一条连线并开始编辑它的标签，见[标签](./edges#标签)                         | `(id: string) => void`                                          |
| `groupNodes`          | 把节点放进新分组，返回分组的 id，见[分组](./groups#方法)                       | `(ids?: string[], type?: string) => string \| null`             |
| `ungroupNode`         | 取消分组                                                                       | `(id: string) => boolean`                                       |
| `leaveGroup`          | 把节点移出分组，返回移出的个数                                                 | `(ids?: string[]) => number`                                    |

### FlowControls Props

| 名称        | 说明           | 类型                                                           | 默认值          |
| ----------- | -------------- | -------------------------------------------------------------- | --------------- |
| `placement` | 所在的角       | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | `'bottom-left'` |
| `history`   | 显示撤销和重做 | `boolean`                                                      | `true`          |
| `tidy`      | 显示整理按钮   | `boolean`                                                      | `true`          |

### FlowMinimap Props

| 名称               | 说明       | 类型                                                           | 默认值           |
| ------------------ | ---------- | -------------------------------------------------------------- | ---------------- |
| `placement`        | 所在的角   | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | `'bottom-right'` |
| `width` / `height` | 尺寸（px） | `number`                                                       | `200` / `136`    |
