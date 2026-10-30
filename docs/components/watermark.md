# Watermark 水印

在内容上方平铺一层文字或图片标记，用于内部资料、截图追溯等场景。

## 基础用法

`content` 是水印文字，传数组时每项一行。水印覆盖默认插槽中的内容，不影响点击和选中文字。

<DocDemo src="watermark/basic" column />

文字水印默认使用主题的文字颜色，透明度 `0.12`，切换亮暗主题时跟着变化。

## 样式

`rotate` 设置旋转角度，`gap` 设置水平与垂直间距，`font` 设置字号、字重、字体与样式。`staggered` 默认开启，让相邻两行错开半个间距；关闭后排成整齐的网格。`color` 与 `opacity` 调整颜色和透明度，`color` 可以是任意 CSS 颜色，包括 CSS 变量。

<DocDemo src="watermark/custom" column />

## 图片水印

`image` 传入图片地址后改为绘制图片，`width` 与 `height` 决定每个标记的大小，默认 120 × 64。图片按原本的颜色绘制，只受 `opacity` 影响。跨域图片需要服务端允许匿名跨域访问。

<DocDemo src="watermark/image" column />

## 整页水印

`fullscreen` 让水印固定覆盖整个视口，不随页面滚动。通常放在应用根组件里，配合 `z-index` 盖在浮层之上。

<DocDemo src="watermark/fullscreen" />

## 防删改

`protect` 默认开启：在页面里删掉水印层、或者修改它的样式与类名后，组件会立即恢复。这只能防止简单的手动修改，不能代替服务端的权限控制。

## API

### Props

| 名称         | 说明                               | 类型                 | 默认值               |
| ------------ | ---------------------------------- | -------------------- | -------------------- |
| `content`    | 水印文字，数组时每项一行           | `string \| string[]` | —                    |
| `image`      | 图片地址，设置后绘制图片而不是文字 | `string`             | —                    |
| `width`      | 单个标记的宽度（px）               | `number`             | 文字自身宽度 / `120` |
| `height`     | 单个标记的高度（px）               | `number`             | 文字自身高度 / `64`  |
| `rotate`     | 旋转角度                           | `number`             | `-22`                |
| `gap`        | 水平与垂直间距（px）               | `[number, number]`   | `[100, 100]`         |
| `staggered`  | 相邻两行错开半个间距               | `boolean`            | `true`               |
| `font`       | 文字样式                           | `WatermarkFont`      | —                    |
| `color`      | 文字颜色                           | `string`             | 主题文字色           |
| `opacity`    | 整层透明度                         | `number`             | `0.12`               |
| `fullscreen` | 固定覆盖整个视口                   | `boolean`            | `false`              |
| `zIndex`     | 水印层的层级                       | `number`             | `9`                  |
| `protect`    | 水印层被删除或修改后自动恢复       | `boolean`            | `true`               |

`WatermarkFont` 的字段为 `size`（px，默认 `14`）、`weight`（默认 `400`）、`family`（默认取容器的字体）与 `style`（`'normal' | 'italic'`）。

### Slots

| 名称      | 说明         |
| --------- | ------------ |
| `default` | 被覆盖的内容 |
