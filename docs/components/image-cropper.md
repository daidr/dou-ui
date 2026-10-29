# ImageCropper 图片裁剪

在固定的裁剪框里移动、缩放和旋转图片，输出裁剪后的图片，常用于上传头像或封面之前。

## 基础用法

`src` 可以是图片地址，也可以是 `File` 或 `Blob`，比如刚选中的文件。`aspect-ratio` 设置裁剪框的宽高比，默认是 `1`。拖动图片移动，滚轮或双指缩放，工具栏可以缩放、旋转和重置。

需要结果时调用实例的 `getBlob()` 或 `getCanvas()`。默认输出裁剪区域在原图中的尺寸，`width` 指定输出宽度，`maxWidth` 限制最大宽度。`change` 事件给出裁剪区域在原图中的位置。

<DocDemo src="image-cropper/basic" />

## 头像

`shape="round"` 把裁剪框显示为圆形，输出仍然是矩形图片，显示时再裁成圆形即可。下面在 [Upload](./upload) 的 `before-upload` 里打开裁剪对话框，确认后用裁剪的文件代替原文件上传。

<DocDemo src="image-cropper/avatar" />

## 跨域图片

画布只能读取同源图片，或者服务器允许跨域的图片。使用其他域名的图片时，设置 `cross-origin="anonymous"`，并确认服务器返回了 `Access-Control-Allow-Origin`。本地选择的文件没有这个限制。

## 键盘与读屏

裁剪区域可以聚焦：方向键移动图片，按住 `Shift` 移动得更多，`+` / `-` 缩放。工具栏的按钮都有读屏名称，缩放滑块读出百分比。

## API

### Props

| 名称          | 说明                                    | 类型                                     | 默认值   |
| ------------- | --------------------------------------- | ---------------------------------------- | -------- |
| `src`         | 图片地址，或 `File` / `Blob`            | `string \| Blob \| null`                 | —        |
| `aspectRatio` | 裁剪框的宽高比                          | `number`                                 | `1`      |
| `shape`       | 裁剪框形状，`round` 只影响显示          | `'rect' \| 'round'`                      | `'rect'` |
| `height`      | 裁剪区域的高度，数字单位为 px；宽度撑满 | `number \| string`                       | `320`    |
| `maxZoom`     | 最大缩放，相对于刚好填满裁剪框的大小    | `number`                                 | `4`      |
| `toolbar`     | 显示缩放滑块与旋转按钮                  | `boolean`                                | `true`   |
| `crossOrigin` | 图片的跨域设置                          | `'' \| 'anonymous' \| 'use-credentials'` | —        |
| `disabled`    | 禁用                                    | `boolean`                                | `false`  |

### Events

| 名称     | 说明                             | 参数                        |
| -------- | -------------------------------- | --------------------------- |
| `ready`  | 图片加载完成                     | `(size: { width, height })` |
| `error`  | 图片加载失败                     | `(event: Event)`            |
| `change` | 裁剪区域变化：拖动、缩放或旋转后 | `(area: ImageCropperArea)`  |

### Exposes

| 名称        | 说明                          | 类型                                      |
| ----------- | ----------------------------- | ----------------------------------------- |
| `getBlob`   | 输出图片文件                  | `(options?) => Promise<Blob \| null>`     |
| `getCanvas` | 把裁剪结果画到新的画布上      | `(options?) => HTMLCanvasElement \| null` |
| `getArea`   | 当前的裁剪区域                | `() => ImageCropperArea \| null`          |
| `rotate`    | 旋转 90° 的倍数，正数为顺时针 | `(degrees: number) => void`               |
| `zoomTo`    | 设置缩放，`1` 为刚好填满      | `(zoom: number) => void`                  |
| `reset`     | 回到居中、不缩放、不旋转      | `() => void`                              |

### 类型

```ts
interface ImageCropperArea {
  // 在旋转后的原图中，单位 px
  x: number
  y: number
  width: number
  height: number
  rotate: number // 0、90、180 或 270
}

interface ImageCropperBlobOptions {
  width?: number // 输出宽度，高度按比例
  maxWidth?: number // 不指定 width 时的最大宽度
  background?: string // 填充透明处，比如输出 JPEG 时用 '#fff'
  type?: string // 默认 'image/png'
  quality?: number // 0–1，有损格式使用
}
```
