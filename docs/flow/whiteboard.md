# 白板

`@dou-ui/flow/whiteboard` 把流程编辑器变成一块白板：可以画矩形、椭圆、菱形，贴便签，写文字，再用带箭头的连接线把它们连起来。白板是同一个 `DouFlowEditor` 加上一组扩展，数据仍然是节点和连线，所以撤销重做、复制粘贴、分组和[协同编辑](./collaboration)都可以直接用。

<DocDemo src="flow/whiteboard" />

## 基础用法

把 `whiteboardKit()` 加在 `flowKit()` 后面就可以用了。它把没写 `type` 的连线默认画成连接线，编辑器的 `edge-type` 属性仍然可以改成别的：

```vue
<script setup lang="ts">
import { DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { whiteboardKit } from '@dou-ui/flow/whiteboard'
import { ref } from 'vue'

const extensions = [flowKit(), whiteboardKit()]
const board = ref<FlowDocument>({ nodes: [], edges: [] })
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

画完一个形状、便签或文字会回到选择工具，画笔和橡皮会一直保持。用键盘时，选好工具后按 Enter 放一个默认大小的：选中了一个节点时放在它后面并连上，否则放在视野中间，都会避开已有的节点。点工具按钮后焦点回到画布，可以直接按键。双击工具按钮可以一直保持这个工具，按钮下方会出现一个小点，按 Esc 或 V 回到选择。在触屏上，选了画图工具后单指按下就是画，不会滚动页面；选择工具下单指仍然是平移画布。

要用自己的工具栏，传入 `toolbar: false` 关掉内置的，再用 `tool` 和它共享当前工具：

```ts
const tool = ref<WhiteboardTool>('select')
const extensions = [flowKit(), whiteboardKit({ tool, toolbar: false })]
```

## 写字

双击形状、便签或文字，或者选中后按 Enter，就可以写字。字在形状里居中、自动换行。Enter 换行，按 Esc、Ctrl + Enter（macOS 上是 ⌘ + Enter）或点别处结束。

## 画笔与橡皮

画笔按指针移动的轨迹画线，并略微平滑手抖。用触控笔时线条随压力变粗变细，鼠标和手指画出的线粗细一致。每一笔是一个 `ink` 节点，可以选中、拖动、拉伸、旋转，也可以撤销。笔迹只在线条上能点中，空白处会点到下面的东西。

橡皮按住后划过的笔迹会先变淡，松开时一起擦掉，算一步撤销；按 Esc 取消，什么都不擦。橡皮只擦笔迹，不擦形状和便签。

## 图片

图片可以拖到画布上、粘贴进来，或者用工具栏的图片按钮（I）选择文件。新图片最长的一边不超过 320，保持原来的比例，放在松手处或视野中间。

不传 `upload` 时，图片以 data URL 存在文档里，适合小图和本地使用。要存到自己的服务器，传入 `upload`，返回图片地址：

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

上传失败的图片不会加进来，读屏会提示。

## 旋转

选中一个白板节点后，它下方有一个圆形的旋转手柄，拖动它旋转，按住 Shift 以 15° 为一档，接近直角时会自动对齐。拖动时按 Esc 取消。右键菜单里也有“顺时针旋转 90°”和“取消旋转”。角度存在 `data.rotation`（度，顺时针），锚点和连接线跟着转。旋转后的节点用自己的缩放手柄，沿着节点自己的边拉伸。

## 层级

后加的节点在上面。右键菜单或快捷键可以调整选中节点的层级：

| 操作     | 快捷键                                           |
| -------- | ------------------------------------------------ |
| 置于顶层 | `Ctrl` / `⌘` + `Shift` + `]`                     |
| 上移一层 | `Ctrl` / `⌘` + `]`，越过上面第一个和它重叠的节点 |
| 下移一层 | `Ctrl` / `⌘` + `[`，越过下面第一个和它重叠的节点 |
| 置于底层 | `Ctrl` / `⌘` + `Shift` + `[`                     |

层级存在节点的 `z` 上，数字大的在上面，一样时按文档里的顺序，见[文档数据](./data)。协同编辑时层级也会同步。

## 连接线

鼠标移到形状、便签或文字上，四边中点会出现锚点。从锚点拖出连接线，拖到另一个形状上任意位置松开，会接到离松手处最近的锚点上。形状移动时连接线跟着走。连接线是直线，终点带箭头，双击可以加文字。松手处的节点接不上时，读屏会提示没有可以连接的端口。

## 节点数据

白板上的东西都是普通节点，`type` 和 `data` 如下：

| 类型     | `data`                                                      | 说明                           |
| -------- | ----------------------------------------------------------- | ------------------------------ |
| `shape`  | `{ shape: 'rect' \| 'ellipse' \| 'diamond', text?, tone? }` | 形状                           |
| `sticky` | `{ text?, tone? }`                                          | 便签，默认 `tone` 是 `warning` |
| `text`   | `{ text? }`                                                 | 文字，没有高度，随内容变高     |
| `ink`    | `{ points, box, size?, tone? }`                             | 笔迹，见下文                   |
| `image`  | `{ src, alt? }`                                             | 图片，`alt` 给读屏用           |

每种节点的 `data` 都可以带 `rotation`。笔迹的 `points` 是 `x, y, 压力` 三个一组的平铺数组，坐标相对节点左上角；`box` 是画下时的宽高，节点被拉伸时笔迹跟着按比例拉伸；`size` 是满压力时的粗细，默认 `4`。

`tone` 取主题的语气色：`neutral`、`primary`、`success`、`warning`、`danger`。形状默认是 `neutral`，用正文颜色描边；其他颜色会给形状描边并淡淡地铺底，给便签铺底。

锚点是端口。每条边上有两个：作为起点的 `top`、`right`、`bottom`、`left`，和作为终点的 `top-in`、`right-in`、`bottom-in`、`left-in`。在数据里写连线时，`source` 用前一种，`target` 用带 `-in` 的：

```ts
const board: FlowDocument = {
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

| 名称      | 说明                                           | 类型                                        | 默认值        |
| --------- | ---------------------------------------------- | ------------------------------------------- | ------------- |
| `tool`    | 当前工具，和自己的工具栏共享；不传时由内部管理 | `Ref<WhiteboardTool>`                       | —             |
| `toolbar` | 是否显示内置工具栏                             | `boolean`                                   | `true`        |
| `upload`  | 把图片文件变成要保存的地址，例如上传后返回 URL | `(file: File) => string \| Promise<string>` | 存为 data URL |

```ts
type WhiteboardTool =
  'select' | 'hand' | 'rect' | 'ellipse' | 'diamond' | 'sticky' | 'text' | 'pen' | 'eraser'
```

### 导出

| 名称                                                          | 说明                                                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `shapeNode`、`stickyNode`、`textNode`、`inkNode`、`imageNode` | 节点类型，可以单独放进自己的扩展里                                                                   |
| `connectorEdge`                                               | 连接线的连线类型                                                                                     |
| `whiteboardKeys`、`imageKey`                                  | 每个工具的按键和插入图片的按键，用来在自己的工具栏上显示                                             |
| `pickImages(ctx, upload?)`                                    | 打开文件选择并插入选中的图片，给自己的工具栏用                                                       |
| `insertImages(ctx, files, upload?, at?)`                      | 插入图片文件，`at` 是画布坐标，默认视野中间                                                          |
| `moveLayer(ctx, move)`                                        | 调整选中节点的层级，`move` 是 `'front'`、`'forward'`、`'backward'`、`'back'`；没有变化时返回 `false` |

### CSS 变量

| 变量                        | 说明                     |
| --------------------------- | ------------------------ |
| `--dou-flow-whiteboard-ink` | 形状、笔迹和连接线的颜色 |
