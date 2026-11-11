# 白板与流程图

`@dou-ui/editor/flow` 提供的 `whiteboardBlock` 和 `flowBlock` 在文档里放一块白板或流程图，内容用[流程编辑器](/flow/)绘制。它们需要安装 `@dou-ui/flow`，并在编辑器的样式之外引入它的样式：

```ts
import '@dou-ui/editor/style'
import '@dou-ui/flow/style'
import { editorKit } from '@dou-ui/editor'
import { whiteboardBlock } from '@dou-ui/editor/flow'

const extensions = [editorKit(), whiteboardBlock()]
```

<DocDemo src="editor/whiteboard" column />

在斜杠菜单里输入“白板”插入。新插入的白板没有内容，点“开始绘制”打开编辑。

## 查看与编辑

文档里显示的是整块内容的预览，缩放到正好放下所有图形，不会放大到超过原来的大小。预览不响应滚轮和拖动，在上面滚动或用手指滑动时，滚动的是页面。单击选中整块，可以像图片一样拖动、复制或删除。

编辑在全屏的编辑器里进行，打开的方式有：

- 双击白板；
- 点白板右上角的“编辑”；
- 选中白板后按 `Enter`。

全屏编辑器里有[白板](/flow/whiteboard)的全部工具。按 `Esc` 或点右上角的关闭按钮回到文档，白板保持选中。画布里有选中的图形时，第一次按 `Esc` 只取消选中，再按一次才回到文档。只读的编辑器里，右上角的按钮是“查看”，打开后可以平移和缩放，但不能修改；没有内容的白板在只读时不能打开。

画布里的修改随时写入文档，`v-model` 和协同编辑的其他人马上能看到。收起或展开分组只改变自己看到的样子，和[折叠块](./toggle-callout)的展开状态一样，不写入文档。

## 撤销

全屏编辑器里的撤销和重做使用文档的撤销记录，每次修改是一步，拖动一个图形的整个过程算一步。撤销只会撤回这块白板上的修改：撤到打开之前的那一步时停下，不会改动编辑器里看不到的其他内容。回到文档后，这些修改仍然可以在文档里逐步撤销。

## 评论

编辑器传了 [`v-model:comments`](./comments) 时，全屏编辑器里的图形和连线也能评论，用法和[流程编辑器的评论](/flow/comments)一样：右键图形或连线、点工具栏上的评论按钮，或者选中后按 `Ctrl/⌘+Alt+M`，也可以把讨论钉在图形里的某一点。讨论和文字上的放在同一个 `comments` 里，作者、`commentable` 和 `v-model:activeComment` 也和文字共用；只读的文档里同样可以评论。

<DocDemo src="editor/whiteboard-comments" column />

文档里的预览会在有讨论的图形和连线上显示标记，点标记会打开全屏编辑器并打开那条讨论。在侧栏的评论列表里打开一条白板上的讨论时，白板会打开全屏编辑器，定位到那个图形并打开讨论；关闭全屏编辑器时讨论一起收起。

讨论的 id 保存在图形和连线的 `comments` 字段里，协同编辑时跟着图形一起合并。和文字上的讨论一样，评论不进撤销记录：撤销白板上的修改不会撤掉讨论；复制粘贴出的白板副本不带讨论。不需要评论的块类型，用 `whiteboardBlock({ commentable: false })` 或 `flowBlock({ commentable: false })` 关掉。

## 高度

白板的宽度跟随所在的栏，高度保存在块的 `height` 属性里，默认 360px。指针移到白板上时，底边中间会出现一条短横线，上下拖动可以调整高度，双击恢复默认，拖动中按 `Esc` 取消。触屏上先点一下选中白板，横线出现后再拖动。键盘上，`Tab` 移到这条横线后按 `↑` `↓`，每次改变 40px。高度在 160px 到 1200px 之间。

`whiteboardBlock({ height: 480 })` 改变新白板的默认高度。

## 文档数据

白板是 `whiteboard` 类型的块，内容在 `board` 属性里，格式与流程编辑器的[文档数据](/flow/data)相同：

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

视图的位置和缩放是每个人自己的，不保存在文档里，每次打开时缩放到放下所有图形。`board` 缺失或格式不对时按没有内容的白板显示，不是对象的节点和连线会被去掉；`height` 不是正数时使用默认高度，超出范围时取最近的边界。`checkDocument` 会把这些情况报告为 `invalid-props`，见[文档数据](./data)。

## 图片

白板里的图片默认以 data URL 存在文档里。文档要保存到服务器或协同编辑时，传入和[图片块](/editor/image)相同的 `upload`，把图片上传后只保存地址：

```ts
const extensions = [
  editorKit(),
  image({ upload }),
  whiteboardBlock({
    upload,
    onUploadError: (file) => toast.danger(`“${file.name}”上传失败`),
  }),
]
```

`onUploadError` 在每张上传失败的图片后调用，传入文件和错误，失败的图片不会放进白板。开发时，白板里出现 data URL 的图片会在控制台提示一次。

## 流程图

白板里的矩形、菱形和连线可以画一般的流程图。需要自己的节点类型（例如带端口的审批节点）时，用 `flowBlock` 定义一种块，`extensions` 和流程编辑器的 `extensions` 相同。下面的 `approvalNodes()` 代表应用自己用 [`defineFlowExtension`](/flow/extensions) 写的扩展：

```ts
import { editorKit } from '@dou-ui/editor'
import { flowBlock } from '@dou-ui/editor/flow'
import { flowKit } from '@dou-ui/flow'
import { approvalNodes } from './approval-nodes'

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

`flowBlock` 的选项见下面的 [API](#api)。

### 添加节点

全屏编辑器左上角有“添加节点”按钮。点击后，节点添加在画布中间；选中一个节点时，新节点添加在它后面，选中的节点有输出端口时会自动连线，连续点击会依次连成一串。按住按钮拖到画布上，节点添加在松手的位置；触屏上需要先按住约 0.3 秒再拖动。从节点的端口拉出连线、在空白处松手，也可以选择一种节点添加在后面。

扩展里没有写 [`palette`](/flow/editing#拖入节点) 的节点类型时（例如不传 `extensions`，或只传 `[flowKit()]`），可以添加的是一种带输入和输出端口的“节点”，双击节点修改文字。扩展里有写了 `palette` 的类型时，按钮列出这些类型；有多种时，按钮打开一个列表，按 `palette.group` 分组，显示 `palette.description`，可以搜索和用方向键选择，也可以从列表里把一项拖到画布上。没有写 `palette` 的类型不会出现在列表里。只读时没有这个按钮。

## 协同编辑

使用[协同编辑](/editor/collaboration)时，`board` 不是作为一个整体保存，而是每个节点、每条连线分开保存，每个字段单独合并。两个人同时修改同一块白板时：

- 移动不同的图形，或者修改同一个图形的不同属性（例如一人移动、一人改文字），两边的修改都保留；
- 修改同一个图形 `data` 里的不同字段（例如一人改文字、一人改颜色），两边的修改都保留；
- 一人删除了图形、另一人同时修改它，图形保持删除；
- 两边同时添加的图形都会保留，图形的前后顺序在所有人那里一致。

其他人的修改会实时出现在预览和打开的全屏编辑器里。

自定义块也可以这样保存：在块的 spec 里写 `mergeProps`，`lists` 列出属性里哪些字段是带 `id` 的列表，`objects` 列出列表条目里按键合并的对象字段：

```ts
defineBlock({
  type: 'kanban',
  props: { board: null },
  content: 'none',
  component: KanbanBlock,
  spec: { mergeProps: { board: { lists: ['columns', 'cards'], objects: ['data'] } } },
})
```

只有列表时可以简写成 `{ board: ['columns', 'cards'] }`。列表条目的顺序随文档保存，所有人看到的顺序一致。

## 导入与导出

`blocksToHTML` 把白板写成带名称的 `<figure>`，内容和高度保存在它的属性里，粘贴回编辑器时还原为白板。要在 HTML 里显示图片，传入 `html`，它返回的内容放在 `<figure>` 里面，替换名称，例如换成应用保存的截图：

```ts
whiteboardBlock({
  html: (board, block) => `<img src="/boards/${block.id}.png" alt="白板">`,
})
```

截图可以用 `@dou-ui/flow` 的 [`renderFlowPNG`](/flow/export) 在浏览器里生成。外面的 `<figure>` 不变，所以传入 `html` 后粘贴回编辑器仍然还原为白板。

`blocksToMarkdown` 把白板写成语言为 `dou-whiteboard` 的代码块，内容是 `{ "height": …, "board": … }` 的 JSON，`markdownToBlocks` 读回时还原为白板；只有 `board` 内容的代码块也能读回，高度用默认值。`flowBlock` 定义的块用 `dou-` 加类型名。

## API

### whiteboardBlock 选项

| 名称            | 说明                                                           | 类型                                               | 默认值 |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------- | ------ |
| `upload`        | 上传白板里的图片，返回地址或 `{ src, alt }`                    | `(file: File) => WhiteboardUploaded \| Promise<…>` | —      |
| `onUploadError` | 图片上传失败时调用                                             | `(file: File, error: unknown) => void`             | —      |
| `height`        | 新白板的高度，单位 px                                          | `number`                                           | `360`  |
| `html`          | `blocksToHTML` 写在 `<figure>` 里的内容                        | `(board: FlowDocument, block) => string`           | 名称   |
| `editorProps`   | 传给预览和全屏编辑器的其他属性                                 | `FlowBlockEditorProps`                             | `{}`   |
| `commentable`   | 图形和连线能否评论，见[评论](#评论)                            | `boolean`                                          | `true` |
| `menu`          | 斜杠菜单项的图标、说明和搜索关键字，`false` 不在斜杠菜单里出现 | `object \| false`                                  | —      |

### flowBlock 选项

| 名称          | 说明                                                                                                 | 类型                                     | 默认值        |
| ------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------- |
| `type`        | 块的类型名，不能和其他块重复                                                                         | `string`                                 | —             |
| `label`       | 斜杠菜单里的名称和全屏编辑器的标题，可以是返回文字的函数                                             | `string \| ((messages) => string)`       | —             |
| `extensions`  | 流程编辑器的扩展；没有写 `palette` 的节点类型时，另外提供一种带端口的“节点”，见[添加节点](#添加节点) | `(FlowExtension \| FlowExtension[])[]`   | `[flowKit()]` |
| `editorProps` | 传给预览和全屏编辑器的其他属性，例如 `nodeTypes`、`portTypes`、`direction`                           | `FlowBlockEditorProps`                   | `{}`          |
| `height`      | 新块的高度，单位 px                                                                                  | `number`                                 | `360`         |
| `commentable` | 节点和连线能否评论，见[评论](#评论)                                                                  | `boolean`                                | `true`        |
| `html`        | `blocksToHTML` 写在 `<figure>` 里的内容                                                              | `(board: FlowDocument, block) => string` | 名称          |
| `menu`        | 斜杠菜单项的图标、说明和搜索关键字，`false` 不在斜杠菜单里出现                                       | `object \| false`                        | —             |

`editorProps` 不能设置 `extensions`、`readonly`、`fitView` 和评论相关的属性：前三个由块决定，评论跟随文档。
