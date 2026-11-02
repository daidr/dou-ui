# 导出与服务端渲染

图表可以导出成 SVG 或 PNG 图片，在服务端渲染时会先输出一张 SVG。

## 导出图片

通过 ref 调用 `exportSVG()` 得到 SVG 文本，`exportPNG()` 得到 PNG 图片的 `Blob`。下载成文件可以使用 `dou-ui` 的 [`downloadBlob`](../guide/composables#downloadblob)。

<DocDemo src="chart/export" />

导出的是图表当前的样子：

- 隐藏的系列、缩放的范围和主题的颜色都和页面上一致。
- 刻度文字、标题、图例、数据标签和标注都在图里。
- 提示框、十字线和框选这些跟随指针的内容不导出。

## 导出选项

- `padding` 设置图片四周的空白，默认 16px。
- `background: false` 不画背景色。
- `exportPNG({ pixelRatio })` 设置每个 CSS 像素对应几个像素，默认是 `2`。

PNG 由 SVG 转成，文字使用系统里的字体。页面使用网络字体时，导出的文字可能和页面上略有不同。

## 图片尺寸限制

浏览器对画布的尺寸有限制：每边最多 16384 像素；总像素数在 iPhone 和 iPad 上约 1677 万，其他设备上是 16384 × 16384。

图片超出限制时，`exportPNG()` 会自动降低 `pixelRatio`；降到 1 仍然放不下时抛出 `RangeError`，不会生成一张模糊的图。遇到时可以减小 `padding`，或者改用 `exportSVG()`。

## 服务端渲染

在服务端渲染时，图表输出一张 SVG 放在页面里，刻度文字、图例和标注都在其中，脚本加载之前就能看到图表。SVG 的颜色使用主题的 CSS 变量，跟随亮暗主题。

- 服务端不知道图表的宽度，所以按 `ssrWidth`（默认 `640`）绘制，再等比缩放到图表的区域里。`height` 是 CSS 长度时按 `320` 计算。
- 浏览器接管页面后，图表按实际宽度画在画布上，然后去掉这张 SVG，不再播放入场动画。
- 环形图中间插槽的内容在浏览器接管之后显示。

## API

### Chart Exposes

| 名称        | 说明                 | 类型                                                                                           |
| ----------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `exportSVG` | 当前的图表，SVG 文本 | `(options?: { background?: boolean, padding?: number }) => string`                             |
| `exportPNG` | 当前的图表，PNG 图片 | `(options?: { background?: boolean, padding?: number, pixelRatio?: number }) => Promise<Blob>` |
