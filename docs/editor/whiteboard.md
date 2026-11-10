# 白板与流程图

`@dou-ui/editor/flow` 提供的 `whiteboardBlock` 和 `flowBlock` 在文档里放一块白板或流程图，内容用[流程编辑器](/flow/)绘制。它们需要安装 `@dou-ui/flow` 并引入它的样式：

```ts
import '@dou-ui/flow/style'
import { editorKit } from '@dou-ui/editor'
import { whiteboardBlock } from '@dou-ui/editor/flow'

const extensions = [editorKit(), whiteboardBlock()]
```

<DocDemo src="editor/whiteboard" column />

在斜杠菜单里输入“白板”插入。新插入的白板是空的，点“开始绘制”打开编辑。

## 查看与编辑

文档里显示的是整块内容的预览，缩放到正好放下所有图形，不会放大到超过原来的大小。预览不响应滚轮和拖动，在上面滚动或用手指滑动时，滚动的是页面。单击选中整块，可以像图片一样拖动、复制或删除。

编辑在全屏的编辑器里进行，打开的方式有：

- 双击白板；
- 点白板右上角的“编辑”；
- 选中白板后按 `Enter`。

全屏编辑器里有[白板](/flow/whiteboard)的全部工具。按 `Esc` 或点右上角的关闭按钮回到文档，白板保持选中。只读的编辑器里，右上角的按钮是“查看”，打开后可以平移和缩放，但不能修改；空白的白板在只读时不能打开。

画布里的修改随时写入文档，`v-model` 和协同编辑的其他人马上能看到。

## 撤销

全屏编辑器里的撤销和重做就是文档的撤销和重做，每次修改是一步，拖动一个图形的整个过程算一步。撤销只会撤回这块白板上的修改：撤到打开之前的那一步时停下，不会改动编辑器里看不到的其他内容。回到文档后，这些修改仍然可以在文档里逐步撤销。

## 高度

白板的宽度跟随所在的栏，高度保存在块的 `height` 属性里，默认 360px。指针移到白板上时，底边中间会出现一条短横线，上下拖动可以调整高度，双击恢复默认，拖动中按 `Esc` 取消。键盘上，`Tab` 移到这条横线后按 `↑` `↓`，每次改变 40px。高度在 160px 到 1200px 之间。

`whiteboardBlock({ height: 480 })` 改变新白板的默认高度。

## 文档数据

白板是 `whiteboard` 类型的块，内容在 `board` 属性里，就是流程编辑器的[文档数据](/flow/data)：

```ts
{
  type: 'whiteboard',
  props: {
    height: 320,
    board: {
      version: 1,
      nodes: [{ id: 'goal', type: 'shape', x: 0, y: 40, width: 180, height: 96, data: { shape: 'ellipse', text: '周末去上海看展' } }],
      edges: [],
    },
  },
}
```

视图的位置和缩放是每个人自己的，不保存在文档里，每次打开时缩放到放下所有图形。`board` 缺失或格式不对时按空白白板显示。

## 图片

白板里的图片默认以 data URL 存在文档里。文档要保存到服务器或协同编辑时，传入和[图片块](/editor/image)相同的 `upload`，把图片上传后只保存地址：

```ts
const extensions = [editorKit(), image({ upload }), whiteboardBlock({ upload })]
```

## 流程图

白板里的矩形、菱形和连线可以画一般的流程图。需要自己的节点类型（例如带端口的审批节点）时，用 `flowBlock` 定义一种块，`extensions` 和流程编辑器的 `extensions` 相同：

```ts
import { flowKit } from '@dou-ui/flow'
import { flowBlock } from '@dou-ui/editor/flow'

const extensions = [
  editorKit(),
  flowBlock({
    type: 'approvalFlow',
    label: '审批流程',
    extensions: [flowKit(), approvalNodes()],
    editorProps: { direction: 'vertical' },
  }),
]
```

`type` 是块的类型名，不能和其他块重复。`label` 用作斜杠菜单里的名称和全屏编辑器的标题，`menu` 可以设置菜单的图标、说明和搜索关键字，`menu: false` 不在斜杠菜单里出现。`editorProps` 传给预览和全屏编辑器，可以设置 `nodeTypes`、`portTypes`、`direction` 等。

## 协同编辑

使用[协同编辑](/editor/collaboration)时，`board` 不是作为一个整体保存，而是每个节点、每条连线分开保存，每个字段单独合并。两个人同时修改同一块白板时：

- 移动不同的图形，或者修改同一个图形的不同属性（例如一人移动、一人改文字），两边的修改都保留；
- 一人删除了图形、另一人同时修改它，图形保持删除。

其他人的修改会实时出现在预览和打开的全屏编辑器里。

自定义块也可以这样保存：在块的 spec 里写 `mergeProps`，列出哪个属性里的哪些字段是带 `id` 的列表：

```ts
defineBlock({
  type: 'kanban',
  props: { board: null },
  content: 'none',
  component: KanbanBlock,
  spec: { mergeProps: { board: ['columns', 'cards'] } },
})
```

## 导入与导出

`blocksToHTML` 把白板写成带名称的 `<figure>`，内容保存在属性里，粘贴回编辑器时还原为白板。要在 HTML 里显示图片，传入 `html`，例如换成应用保存的截图：

```ts
whiteboardBlock({
  html: (board, block) => `<img src="/boards/${block.id}.png" alt="白板">`,
})
```

截图可以用 `@dou-ui/flow` 的 [`renderFlowPNG`](/flow/export) 在浏览器里生成。

`blocksToMarkdown` 把白板写成语言为 `dou-whiteboard` 的代码块，内容是 `board` 的 JSON，`markdownToBlocks` 读回时还原为白板。`flowBlock` 定义的块用 `dou-` 加类型名。
