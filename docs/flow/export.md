# 导出图片

`exportSVG` 和 `exportPNG` 把流程画成图片，样子和画布上一致：节点、连线、连线上的文字都在，选中框、手柄和网格点不画。

## 基础用法

两个方法在组件实例和 `useFlowEditor()` 上都有：

<DocDemo src="flow/export" column />

```ts
const svg = editor.value.exportSVG() // SVG 文本
const png = await editor.value.exportPNG() // PNG 的 Blob
```

导出的方法只返回内容，下载可以用 `dou-ui` 的 [`downloadBlob`](../guide/composables#downloadblob)，如上面示例所示。

## 范围

`range` 决定导出哪一部分，有三种：

- `'all'`（默认）：全部节点，四周留 `padding`（默认 24px）。
- `'view'`：画布上现在看得到的部分，大小和画布一致，边上的节点和连线在画布边缘截断。不使用 `padding`。
- `'selection'`：选中的节点、选中分组里的节点，以及它们之间的连线。什么都没选时会抛出错误，调用前先确认有选中的节点，比如没有选中时禁用导出按钮。

折叠的分组按折叠后的样子画，导出的图里不画折叠箭头。放不下的文字只画能完整显示的行，最后一行末尾加省略号，和画布上一致。

## SVG

SVG 是文本，可以在矢量设计软件里继续编辑。

- 颜色都写成 sRGB 的 `rgb(…)`、`rgba(…)` 或 `#rrggbb`，矢量设计软件可以直接打开和编辑；主题里用到的 `oklab`、`color-mix` 等写法会先换算成这几种。
- 文字按画布上的字体和字号换行，用的是页面上的字体，在没有这个字体的电脑上打开时会换成其他字体。
- 图片保留原来的地址。

## PNG

PNG 是位图，适合直接发送或插入文档。

- 默认按 2 倍像素导出，`pixelRatio` 可以改。
- 图片节点的图片会嵌进 PNG。图片地址在别的域名下、又不允许跨域读取时读不到，那张图片画成和画布上一样的占位（灰色方块加图片图标）；读不到的地址会记下来，同一个编辑器之后再导出时不再请求。

浏览器对画布的尺寸有限制：每边 16384 像素，总像素数在 iPhone 和 iPad 上约 1677 万，其他设备上是 16384 × 16384。图片很大时 `exportPNG()` 会自动降低 `pixelRatio`，降到 1 仍然放不下时会抛出 `RangeError`，不会生成一张模糊的图。这时可以用 `range: 'view'` 或 `range: 'selection'` 分几次导出，或者改用 `exportSVG()`。`renderFlowPNG()` 遇到同样的情况也抛出 `RangeError`，这时改用 `renderFlowSVG()`。

## 不挂编辑器导出

`renderFlowSVG(document, options?)` 和 `renderFlowPNG(document, options?)` 直接把一份文档画成图片，页面上不需要有编辑器，适合产物列表里的缩略图、分享前的预览。两者都返回 Promise。

```ts
import { renderFlowSVG } from '@dou-ui/flow'
import '@dou-ui/flow/style'
import { onMounted, ref } from 'vue'

const thumbnail = ref('')
// 只能在浏览器里画：放在 onMounted 或点击处理里，不要写在 <script setup> 顶层
onMounted(async () => {
  const svg = await renderFlowSVG(doc, { colorMode: 'light', padding: 12 })
  thumbnail.value = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
})
```

画法和 `exportSVG` 完全相同：函数在页面上临时挂一个看不见的只读编辑器，等节点排好、量好尺寸后导出，然后立即移除。所以：

- 节点形状、文字、端口、曲线连线、分组都和画布上一致，自定义节点组件放的端口也在原位。
- 要传入和显示这份文档的编辑器相同的 `extensions`、`nodeTypes`、`edgeTypes`、`portTypes`，否则用不到的类型会按默认节点画。
- 需要浏览器环境，在服务端调用会抛出错误。
- 需要流程编辑器的样式。用解析器或 Nuxt 模块自动引入时，样式随 `<DouFlowEditor>` 一起加载；页面上没有编辑器、只调用这两个函数时，要自己引入 `@dou-ui/flow/style`，否则会抛出错误提示。
- 文档里有没注册的节点类型时，开发环境会在控制台提示一次（编辑器也一样）。
- 一次只画一份。十几张缩略图依次调用即可，每次结束后不留下任何东西；文档没变时，可以把结果缓存起来。

<DocDemo src="flow/render" column />

`colorMode` 设为 `'light'` 或 `'dark'` 时按这种颜色模式画，不设时跟随页面当前的颜色模式。

节点组件默认在配置了 DouUI 的应用里渲染（`app.use(DouUI)`、`provideGlobalConfig(config, app)` 或 Nuxt 模块，见 [installedAppContext](/guide/composables#installedappcontext)），沿用它的语言包和全局配置。节点组件还要用到别的插件或 `provide`，或者有多个应用时，传入 `appContext`，例如 `getCurrentInstance()!.appContext`。`DouConfigProvider` 这类写在组件树里的设置带不过去，需要时用 `messages` 改写文字。

## 自定义节点

节点类型可以提供 `draw`，返回节点的 SVG 标记，坐标以节点左上角为原点。没有 `draw` 的节点画成一张带名称和端口的卡片。

```ts
import { defineNodeType, drawCard } from '@dou-ui/flow'
import NoteNode from './note-node.vue'

const noteNode = defineNodeType<{ text?: string }>({
  type: 'note',
  component: NoteNode,
  draw: (node, draw) =>
    drawCard(draw) +
    draw.text(
      node.data?.text ?? '',
      { x: 12, y: 12, width: draw.width - 24, height: draw.height - 24 },
      { color: draw.color('var(--dou-color-text-secondary)') },
    ) +
    draw.port('in') +
    draw.port('out'),
})
```

节点类型写了 [`rotation`](./custom-nodes#definenodetype) 时，`draw` 也要自己画出旋转，例如把内容包在 `<g transform="rotate(角度 宽/2 高/2)">` 里；导出的画布范围会按旋转后的外接框留出。

`draw` 的第二个参数是 `FlowDrawContext`，提供节点的大小、读取主题颜色、写文字、画图标和图片、画端口等工具，见下方的 [FlowDrawContext](#flowdrawcontext)。

`drawCard(draw)` 画出编辑器默认的卡片（边框、底色和圆角），从 `@dou-ui/flow` 导入。

## 扩展的图层

扩展用 `layers.above` 在节点上方显示的内容（例如便签上的票数），导出时不会自动画出来。扩展可以提供 `drawLayer(ctx, draw, nodes)`，返回画布坐标下的 SVG 标记，画在所有节点上方。`nodes` 是这次导出画进去的节点，`draw` 和节点类型的 `draw` 收到的工具相同，其中 `width`、`height` 是整张图的大小。[头脑风暴](/blocks/brainstorm) 区块用它把票数画进导出的图片。

## API

### Exposes

| 名称                  | 说明          | 类型                                            |
| --------------------- | ------------- | ----------------------------------------------- |
| `exportSVG(options?)` | 导出 SVG 文本 | `(options?: FlowExportOptions) => string`       |
| `exportPNG(options?)` | 导出 PNG      | `(options?: FlowImageOptions) => Promise<Blob>` |

### FlowExportOptions / FlowImageOptions

`exportSVG` 的选项是 `FlowExportOptions`；`exportPNG` 的 `FlowImageOptions` 多一个 `pixelRatio`。

| 选项         | 说明                                   | 类型                             | 默认值  |
| ------------ | -------------------------------------- | -------------------------------- | ------- |
| `range`      | 导出全部、当前视图，或选中的部分       | `'all' \| 'view' \| 'selection'` | `'all'` |
| `padding`    | 四周留白，单位 px；`'view'` 不使用     | `number`                         | `24`    |
| `background` | 是否铺上画布的底色；`false` 时背景透明 | `boolean`                        | `true`  |
| `pixelRatio` | 仅 PNG：每个 CSS 像素对应的图片像素    | `number`                         | `2`     |

### 函数

| 名称                                | 说明                                                  | 类型                                                                              |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `renderFlowSVG(document, options?)` | 不挂编辑器，把文档画成 SVG 文本                       | `(document: FlowDocument, options?: RenderFlowOptions) => Promise<string>`        |
| `renderFlowPNG(document, options?)` | 不挂编辑器，把文档画成 PNG                            | `(document: FlowDocument, options?: RenderFlowImageOptions) => Promise<Blob>`     |
| `drawCard(draw, classes?)`          | 画出编辑器默认的卡片，`classes` 是卡片上额外的类名    | `(draw: FlowDrawContext, classes?: string[]) => string`                           |
| `drawLayer`                         | 扩展的选项：返回画在所有节点上方的 SVG 标记，画布坐标 | `(ctx: FlowExtensionContext, draw: FlowDrawContext, nodes: FlowNode[]) => string` |

### RenderFlowOptions / RenderFlowImageOptions

`renderFlowSVG` 的选项是 `RenderFlowOptions`；`renderFlowPNG` 的 `RenderFlowImageOptions` 多一个 `pixelRatio`。

| 选项                                                                                     | 说明                                | 类型                 | 默认值              |
| ---------------------------------------------------------------------------------------- | ----------------------------------- | -------------------- | ------------------- |
| `extensions`、`nodeTypes`、`edgeTypes`、`edgeType`、`portTypes`、`direction`、`messages` | 与编辑器的同名属性相同              | —                    | —                   |
| `colorMode`                                                                              | 按浅色或深色画；不设时跟随页面      | `'light' \| 'dark'`  | —                   |
| `padding`                                                                                | 四周留白，单位 px                   | `number`             | `24`                |
| `background`                                                                             | 是否铺上画布的底色                  | `boolean`            | `true`              |
| `appContext`                                                                             | 节点组件渲染时使用的应用上下文      | `AppContext \| null` | 配置了 DouUI 的应用 |
| `pixelRatio`                                                                             | 仅 PNG：每个 CSS 像素对应的图片像素 | `number`             | `2`                 |

### FlowDrawContext

| 名称               | 说明                                                                                     | 类型                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `width` / `height` | 节点的大小；`drawLayer` 里是整张图的大小                                                 | `number`                                                              |
| `style`            | 在编辑器里用这些类名（从外到内）建一个元素，返回它的计算样式，用来读取主题里的颜色和尺寸 | `(...classes: string[]) => CSSStyleDeclaration`                       |
| `color`            | 把 CSS 颜色（可以带 `var()`）换算成 sRGB 的 `rgb(…)`、`rgba(…)` 或 `#rrggbb`             | `(value: string) => string`                                           |
| `text`             | 在方框里写文字，按宽度换行，超出高度的行不画，最后一行加省略号                           | `(value: string, box: Rect, options?: FlowDrawTextOptions) => string` |
| `icon`             | 画一个图标组件，例如 `@dou-ui/icons` 里的图标                                            | `(icon: Component, box: Rect, color: string) => string`               |
| `image`            | 画一张图片，PNG 里会嵌入图片数据；`radius` 是圆角                                        | `(src: string, box: Rect, options?: { radius?: number }) => string`   |
| `port`             | 按画布上的样子画一个端口                                                                 | `(id: string) => string`                                              |
| `ports`            | 每个端口在节点上的位置                                                                   | `ReadonlyMap<string, PortAnchor>`                                     |
| `messages`         | 编辑器当前的文案                                                                         | `FlowMessages`                                                        |
| `escape`           | 转义 SVG 里的文字                                                                        | `(text: string) => string`                                            |

`Rect` 是 `{ x, y, width, height }`。

### FlowDrawTextOptions

| 名称         | 说明                         | 类型                           | 默认值        |
| ------------ | ---------------------------- | ------------------------------ | ------------- |
| `size`       | 字号（px）                   | `number`                       | 编辑器的字号  |
| `weight`     | 字重，如 `500`               | `string \| number`             | `400`         |
| `lineHeight` | 行高（px）                   | `number`                       | 字号的 1.5 倍 |
| `color`      | 文字颜色                     | `string`                       | —             |
| `align`      | 水平对齐                     | `'start' \| 'center' \| 'end'` | `'start'`     |
| `valign`     | 文字比方框矮时的垂直位置     | `'top' \| 'middle'`            | `'top'`       |
| `nowrap`     | 只写一行，超出的部分用省略号 | `boolean`                      | `false`       |
