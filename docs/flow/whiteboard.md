# 白板

`@dou-ui/flow/whiteboard` 把流程编辑器变成一块白板：可以画矩形、椭圆、菱形，贴便签，写文字，再用带箭头的连接线把它们连起来。白板是同一个 `DouFlowEditor` 加上一组扩展，数据仍然是节点和连线，所以撤销重做、复制粘贴、分组和[协同编辑](./collaboration)都可以直接用。

<DocDemo src="flow/whiteboard" />

## 基础用法

把 `whiteboardKit()` 加在 `flowKit()` 后面就可以用了。它把没写 `type` 的连线默认画成连接线，编辑器的 `edgeType` 属性仍然可以改成别的：

```vue
<script setup lang="ts">
import { DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { whiteboardKit } from '@dou-ui/flow/whiteboard'
import { ref } from 'vue'

const extensions = [flowKit(), whiteboardKit()]
const board = ref<FlowDocument>({ version: 1, nodes: [], edges: [] })
</script>

<template>
  <DouFlowEditor v-model="board" :extensions="extensions" />
</template>
```

## 工具

编辑器顶部有一排工具，每个工具都有单键快捷键：

| 工具     | 按键 | 说明                                                        |
| -------- | ---- | ----------------------------------------------------------- |
| 选择     | V    | 和普通的流程编辑器一样：选中、框选、拖动、调整大小          |
| 移动画布 | H    | 按住拖动画布                                                |
| 矩形     | R    | 拖出一个框画形状，点一下放一个默认大小的；按住 Shift 画正的 |
| 椭圆     | O    | 同上                                                        |
| 菱形     | D    | 同上                                                        |
| 便签     | S    | 放下后直接开始写字                                          |
| 文字     | T    | 放下后直接开始写字，没写字就不留下                          |
| 画笔     | P    | 按住画线，松开后成为一条笔迹                                |
| 橡皮     | X    | 按住划过笔迹，松开后擦掉碰到的                              |
| 图片     | I    | 选择图片文件插入；不是工具，按下就打开文件选择              |

- 画完一个形状、便签或文字会回到选择工具，画笔和橡皮会一直保持。
- 双击工具按钮可以一直保持这个工具，按钮下方会出现一个小点，按 Esc 或 V 回到选择。
- 用键盘时，选好工具后按 Enter 放一个默认大小的：选中了一个节点时放在它后面并连上，否则放在视野中间，都会避开已有的节点。点工具按钮后焦点回到画布，可以直接按键。
- 在触屏上，选了画图工具后单指按下开始画，不会滚动页面；选择工具下单指仍然是平移画布。

要用自己的工具栏，传入 `toolbar: false` 关掉内置的，再用 `tool` 和它共享当前工具：

```ts
import { flowKit } from '@dou-ui/flow'
import { whiteboardKit, type WhiteboardTool } from '@dou-ui/flow/whiteboard'
import { ref } from 'vue'

const tool = ref<WhiteboardTool>('select')
const extensions = [flowKit(), whiteboardKit({ tool, toolbar: false })]
```

## 写字

双击形状、便签或文字，或者选中后按 Enter，就可以写字。字在形状里居中、自动换行。Enter 换行，按 Esc、Ctrl + Enter（macOS 上是 ⌘ + Enter）或点别处结束。

## 画笔与橡皮

画笔按指针移动的轨迹画线，并略微平滑手抖。

- 用触控笔时线条随压力变粗变细，鼠标和手指画出的线粗细一致。
- 每一笔是一个 `ink` 节点，可以选中、拖动、拉伸、旋转，也可以撤销。
- 笔迹只在线条上能点中，空白处会点到下面的东西。

橡皮按住后划过的笔迹会先变淡，松开时一起擦掉，算一步撤销；按 Esc 取消，什么都不擦。橡皮只擦笔迹，不擦形状和便签。

## 图片

图片可以拖到画布上、粘贴进来，或者用工具栏的图片按钮（I）选择文件。新图片最长的一边不超过 320，保持原来的比例，放在松手处或视野中间。

不传 `upload` 时，图片以 data URL 存在文档里，适合小图和本地使用。data URL 会让文档变得很大，[协同编辑](./collaboration)时每个人打开都要下载整份文档，这时请传入 `upload`，把文件存到自己的服务器，返回图片地址：

```ts
const extensions = [
  flowKit(),
  whiteboardKit({
    async upload(file) {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body })
      return (await res.json()).url
    },
  }),
]
```

`upload` 也可以返回 `{ src, alt }`，给图片写说明文字，供读屏使用；只返回地址时，说明文字是去掉扩展名的文件名。之后要修改，用 `transact` 更新节点的 `data.alt`。

`upload` 抛出错误或返回被拒绝的 Promise 时，这张图片不会加进来，屏幕下方会弹出一条错误提示，说明哪张图片没能添加，读屏也会朗读。一次拖入、粘贴或选择的图片里有两张或更多失败时，合成一条提示，说明有几张没能添加。

想用自己的方式提示，例如显示服务器返回的原因，传入 `onUploadError`。每张失败的图片调用它一次，传入错误和对应的文件。传了它，默认提示和读屏朗读都不再出现，由应用自己告诉用户：

```ts
import { toast } from 'dou-ui'

whiteboardKit({
  upload,
  onUploadError(error, file) {
    toast.danger(`${file.name} 上传失败：${(error as Error).message}`)
  },
})
```

## 旋转

选中一个白板节点后，它下方有一个圆形的旋转手柄，拖动它旋转。

- 按住 Shift 以 15° 为一档，接近直角时会自动对齐；拖动时按 Esc 取消。
- 只选中一个节点时，右键菜单里也有“顺时针旋转 90°”和“取消旋转”。
- 角度存在 `data.rotation`（度，顺时针），锚点和连接线跟着转。
- 旋转后的节点用自己的缩放手柄，沿着节点自己的边拉伸。

## 层级

后加的节点在上面。调整层级来自 `flowKit()`，普通流程里也能用：右键菜单或 `Ctrl` / `⌘` + `]`、`[`，加 `Shift` 直接到顶层或底层，见[层级](./editing#层级)。协同编辑时层级也会同步。

## 连接线

鼠标移到形状、便签或文字上，四边中点会出现锚点。从锚点拖出连接线，拖到另一个形状上任意位置松开，会接到离松手处最近的锚点上。形状移动时连接线跟着走，双击可以加文字。松手处的节点接不上时，读屏会提示没有可以连接的端口。

新画的连接线是直线、实线，终点带箭头。选中连接线后，浮动工具栏上有三个按钮，可以换：

- 走向：直线、折线、曲线。折线中间那一段可以拖动。
- 线型：实线、虚线、点线、点划线。箭头始终是实线。
- 箭头：无箭头、终点箭头、两端箭头。

同时选中多条连接线时，选择会作用到每一条。

<DocDemo src="flow/whiteboard-connectors" column />

样式存在连线的 `data` 里：

| 字段    | 说明                                           | 类型                                            | 默认值       |
| ------- | ---------------------------------------------- | ----------------------------------------------- | ------------ |
| `route` | 走向                                           | `'straight' \| 'elbow' \| 'curve'`              | `'straight'` |
| `dash`  | 线型                                           | `'solid' \| 'dashed' \| 'dotted' \| 'dash-dot'` | `'solid'`    |
| `arrow` | 箭头画在哪一端                                 | `'none' \| 'end' \| 'both'`                     | `'end'`      |
| `bend`  | 折线中间一段的位置，0 到 1，拖动折线时自动写入 | `number`                                        | `0.5`        |

## 导出

`exportSVG()` 和 `exportPNG()` 把白板导出成图片，形状、便签、笔迹、图片和旋转都按画布上的样子画出来，见[导出图片](./export)。

## 协同编辑

白板的数据是普通的节点和连线，所以加上 [`collaboration()`](./collaboration) 扩展就能多人同时编辑：形状、便签、笔迹、图片、旋转和层级都会同步。工具、正在画的笔迹和正在输入的文字只在自己这边，松手或写完后才同步给其他人。

<DocDemo src="flow/whiteboard-collaboration" column />

```ts
const extensions = [
  flowKit(),
  whiteboardKit({ upload }),
  collaboration({ nodes: doc.getMap('nodes'), edges: doc.getMap('edges'), awareness, user }),
]
```

协同时请传入 `upload`，把图片存到服务器，不要让 data URL 进入共享文档。

## 节点数据

白板上的东西都是普通节点，`type` 和 `data` 如下：

| 类型     | `data`                                                      | 说明                           |
| -------- | ----------------------------------------------------------- | ------------------------------ |
| `shape`  | `{ shape: 'rect' \| 'ellipse' \| 'diamond', text?, tone? }` | 形状                           |
| `sticky` | `{ text?, tone? }`                                          | 便签，默认 `tone` 是 `warning` |
| `text`   | `{ text? }`                                                 | 文字，没有高度，随内容变高     |
| `ink`    | `{ points, box, size?, tone? }`                             | 笔迹，见下文                   |
| `image`  | `{ src, alt? }`                                             | 图片，`alt` 给读屏用           |

- 每种节点的 `data` 都可以带 `rotation`。旋转只属于白板节点，所以放在 `data` 里；层级 `z` 是所有节点都有的绘制顺序，放在节点上。
- 笔迹的 `points` 是 `x, y, 压力` 三个一组的平铺数组，坐标相对节点左上角；`box` 是画下时的宽高，节点被拉伸时笔迹跟着按比例拉伸；`size` 是鼠标、手指画出的线宽，默认 `4`，用触控笔时随压力在 0.4 到 1.6 倍之间变化。

`tone` 取主题的语气色：`neutral`、`primary`、`success`、`warning`、`danger`。形状默认是 `neutral`，用正文颜色描边；其他颜色会给形状描边并淡淡地铺底，给便签铺底。

锚点是端口。每条边上有两个：作为起点的 `top`、`right`、`bottom`、`left`，和作为终点的 `top-in`、`right-in`、`bottom-in`、`left-in`。在数据里写连线时，`source` 用前一种，`target` 用带 `-in` 的：

```ts
const board: FlowDocument = {
  version: 1,
  nodes: [
    {
      id: 'a',
      type: 'shape',
      x: 0,
      y: 0,
      width: 160,
      height: 100,
      data: { shape: 'rect', text: '出发' },
    },
    { id: 'b', type: 'sticky', x: 260, y: 0, width: 160, height: 160, data: { text: '带伞' } },
  ],
  edges: [
    // 从 a 的右边连到 b 的左边
    { id: 'e1', source: { node: 'a', port: 'right' }, target: { node: 'b', port: 'left-in' } },
  ],
}
```

读屏读到的名称跟着编辑器的语言，例如“矩形”“便签：带伞”。

## API

### whiteboardKit 选项

| 名称            | 说明                                                                      | 类型                                                                | 默认值        |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------- |
| `tool`          | 当前工具，和自己的工具栏共享；不传时由内部管理                            | `Ref<WhiteboardTool>`                                               | —             |
| `toolbar`       | 是否显示内置工具栏                                                        | `boolean`                                                           | `true`        |
| `upload`        | 把图片文件变成要保存的地址，例如上传后返回 URL；也可以返回 `{ src, alt }` | `(file: File) => WhiteboardUploaded \| Promise<WhiteboardUploaded>` | 存为 data URL |
| `onUploadError` | 每张上传失败的图片调用一次；传了就不再显示默认的错误提示，也不再朗读      | `(error: unknown, file: File) => void`                              | 显示错误提示  |

```ts
type WhiteboardUploaded = string | { src: string; alt?: string }

type WhiteboardTool =
  'select' | 'hand' | 'rect' | 'ellipse' | 'diamond' | 'sticky' | 'text' | 'pen' | 'eraser'
```

### 导出

以下都从 `@dou-ui/flow/whiteboard` 引入。

| 名称                                                          | 说明                                           | 类型                                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `shapeNode`、`stickyNode`、`textNode`、`inkNode`、`imageNode` | 节点类型，可以单独放进自己的扩展里             | `NodeTypeSpec`                                                                               |
| `connectorEdge`                                               | 连接线的连线类型，`data` 见[连接线](#连接线)   | `EdgeTypeSpec`                                                                               |
| `whiteboardKeys`                                              | 每个工具的按键，用来在自己的工具栏上显示       | `Record<WhiteboardTool, string>`                                                             |
| `imageKey`                                                    | 插入图片的按键                                 | `string`                                                                                     |
| `pickImages`                                                  | 打开文件选择并插入选中的图片，给自己的工具栏用 | `(ctx: FlowEditorContext, options?: WhiteboardImageOptions) => void`                         |
| `insertImages`                                                | 插入图片文件                                   | `(ctx: FlowEditorContext, files: File[], options?: WhiteboardImageOptions) => Promise<void>` |

### WhiteboardImageOptions

| 名称            | 说明                         | 类型                                                                | 默认值                             |
| --------------- | ---------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `at`            | 图片放在哪里，画布坐标       | `{ x: number; y: number }`                                          | 视野中间                           |
| `upload`        | 这次插入用的上传函数         | `(file: File) => WhiteboardUploaded \| Promise<WhiteboardUploaded>` | `whiteboardKit` 的 `upload`        |
| `onUploadError` | 这次插入的图片上传失败时调用 | `(error: unknown, file: File) => void`                              | `whiteboardKit` 的 `onUploadError` |

### CSS 变量

| 变量                        | 说明                     |
| --------------------------- | ------------------------ |
| `--dou-flow-whiteboard-ink` | 形状、笔迹和连接线的颜色 |
