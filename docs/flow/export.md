# 导出图片

`exportSVG` 和 `exportPNG` 把流程画成图片，样子和画布上一致：节点、连线、连线上的文字都在，选中框、手柄和网格点不画。它们在组件实例和 `useFlowEditor()` 上都有。

<DocDemo src="flow/export" column />

```ts
const svg = editor.value.exportSVG() // SVG 文本
const png = await editor.value.exportPNG() // PNG 的 Blob
```

导出的范围有三种：

- `'all'`（默认）：全部节点，四周留 `padding`（默认 24px）。
- `'view'`：画布上现在看得到的部分，大小和画布一致，边上的节点和连线在画布边缘截断。不使用 `padding`。
- `'selection'`：选中的节点、选中分组里的节点，以及它们之间的连线。什么都没选时会抛出错误，调用前先确认有选中的节点，比如没有选中时禁用导出按钮。

折叠的分组按折叠后的样子画，导出的图里不画折叠箭头。放不下的文字只画能完整显示的行，最后一行末尾加省略号，和画布上一致。

SVG 里的颜色都写成 sRGB 的 `rgb(…)`、`rgba(…)` 或 `#rrggbb`，矢量设计软件可以直接打开和编辑。主题里用到的 `oklab`、`color-mix` 等写法会先换算成这几种。文字按画布上的字体和字号换行，用的是页面上的字体，在没有这个字体的电脑上打开时会换成其他字体。

PNG 默认按 2 倍像素导出，`pixelRatio` 可以改。图片节点的图片会嵌进 PNG；图片地址在别的域名下、又不允许跨域读取时读不到，那张图片画成和画布上一样的占位（灰色方块加图片图标）。读不到的地址会记下来，同一个编辑器之后再导出时不再请求。SVG 里的图片保留原来的地址。

浏览器对画布的尺寸有限制（每边 16384 像素；总像素数在 iPhone 和 iPad 上约 1677 万，其他设备上是 16384 × 16384），图片很大时 `exportPNG()` 会自动降低 `pixelRatio`，降到 1 仍然放不下时会抛出 `RangeError`，不会生成一张模糊的图。这时可以用 `range: 'view'` 或 `range: 'selection'` 分几次导出，或者改用 `exportSVG()`。

导出的方法只返回内容，下载可以用 `dou-ui` 的 [`downloadBlob`](../guide/composables#downloadblob)，如上面示例所示。

## 自定义节点

节点类型可以提供 `draw`，返回节点的 SVG 标记，坐标以节点左上角为原点。没有 `draw` 的节点画成一张带名称和端口的卡片。

```ts
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

`draw` 的第二个参数提供这些工具：

| 名称                         | 说明                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`、`height`            | 节点的大小                                                                                                                                        |
| `style(...classes)`          | 在编辑器里用这些类名（从外到内）建一个元素，返回它的计算样式，用来读取主题里的颜色和尺寸                                                          |
| `color(value)`               | 把 CSS 颜色（可以带 `var()`）换算成 sRGB 的 `rgb(…)`、`rgba(…)` 或 `#rrggbb`                                                                      |
| `text(value, box, options?)` | 在方框里写文字，按宽度换行，超出高度的行不画，最后一行加省略号；`options` 有 `size`、`weight`、`lineHeight`、`color`、`align`、`valign`、`nowrap` |
| `icon(icon, box, color)`     | 画一个图标组件，例如 `@dou-ui/icons` 里的图标                                                                                                     |
| `image(src, box, options?)`  | 画一张图片，PNG 里会嵌入图片数据；`options.radius` 是圆角                                                                                         |
| `port(id)`                   | 按画布上的样子画一个端口                                                                                                                          |
| `ports`                      | 每个端口在节点上的位置                                                                                                                            |
| `messages`                   | 编辑器当前的文案                                                                                                                                  |
| `escape(text)`               | 转义 SVG 里的文字                                                                                                                                 |

`drawCard(draw)` 画出编辑器默认的卡片（边框、底色和圆角），从 `@dou-ui/flow` 导入。

## 扩展的图层

扩展用 `layers.above` 在节点上方显示的内容（例如便签上的票数），导出时不会自动画出来。扩展可以提供 `drawLayer(ctx, draw, nodes)`，返回画布坐标下的 SVG 标记，画在所有节点上方。`nodes` 是这次导出画进去的节点，`draw` 和节点类型的 `draw` 收到的工具相同，其中 `width`、`height` 是整张图的大小。[头脑风暴](/blocks/brainstorm) 区块用它把票数画进导出的图片。

## API

| 名称                  | 说明          | 类型                                            |
| --------------------- | ------------- | ----------------------------------------------- |
| `exportSVG(options?)` | 导出 SVG 文本 | `(options?: FlowExportOptions) => string`       |
| `exportPNG(options?)` | 导出 PNG      | `(options?: FlowImageOptions) => Promise<Blob>` |

| 选项         | 说明                                   | 类型                             | 默认值  |
| ------------ | -------------------------------------- | -------------------------------- | ------- |
| `range`      | 导出全部、当前视图，或选中的部分       | `'all' \| 'view' \| 'selection'` | `'all'` |
| `padding`    | 四周留白，单位 px；`'view'` 不使用     | `number`                         | `24`    |
| `background` | 是否铺上画布的底色；`false` 时背景透明 | `boolean`                        | `true`  |
| `pixelRatio` | 仅 PNG：每个 CSS 像素对应的图片像素    | `number`                         | `2`     |
