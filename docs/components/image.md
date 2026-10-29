# Image 图片

图片容器，提供加载中和加载失败的状态。

## 基础用法

<DocDemo src="image/basic" />

`width` / `height` 决定盒子大小（数字为 px），`fit` 决定图片如何填满盒子，对应 CSS 的 `object-fit`，默认 `cover`。`lazy` 使用浏览器原生的 `loading="lazy"`，图片接近视口时才加载。

## 加载失败

`fallback` 是 `src` 失败后再试一次的地址；仍然失败时显示错误状态，有 `alt` 就把它写出来。`error` 插槽可以换成别的内容，`placeholder` 插槽替换加载中的微光。

<DocDemo src="image/error" />

## 预览

`preview` 让图片可以点击放大。预览时背景为接近黑色的遮罩（亮色和暗色主题相同），图片居中显示，底部是浮动的工具栏：缩放（显示当前比例）、旋转、水平与垂直翻转、还原。放大后可以拖动；滚轮缩放，双击在 100% 和 200% 之间切换。

`preview-list` 传入一组图片后，预览里可以左右切换；每张图在列表里的位置按地址自动找到，也可以用 `preview-index` 指定。`preview-src` 指定一张更大的原图。

<DocDemo src="image/preview" />

`downloadable` 在工具栏末尾加一个下载按钮，文件名取图片地址的最后一段。其他域名的图片只有在对方允许跨域时才能直接下载，否则会在新标签页中打开。

## 单独使用预览

`DouImagePreview` 是预览本身，可以不经过缩略图直接打开，例如从表格里的“查看附件”按钮：

```vue
<DouButton @click="open = true">查看附件</DouButton>
<DouImagePreview v-model:open="open" v-model:index="index" :images="attachments" loop />
```

## 键盘与读屏

可预览的图片是一个按钮（`aria-haspopup="dialog"`），以 `alt` 作为名称，`Enter` 或 `Space` 打开。预览是模态的 `role="dialog"`，焦点困在里面，关闭后回到原处；页数与缩放比例的变化会被播报。

| 按键    | 行为                   |
| ------- | ---------------------- |
| `←` `→` | 上一张 / 下一张        |
| `+` `-` | 放大 / 缩小            |
| `0`     | 还原                   |
| `R`     | 向右旋转，`Shift` 向左 |
| `H` `V` | 水平翻转 / 垂直翻转    |
| `Esc`   | 关闭                   |

## API

### Image Props

| 名称           | 说明                            | 类型                                                       | 默认值     |
| -------------- | ------------------------------- | ---------------------------------------------------------- | ---------- |
| `src`          | 图片地址                        | `string`                                                   | —          |
| `alt`          | 替代文字；只在纯装饰时留空      | `string`                                                   | —          |
| `width`        | 宽度，数字为 px                 | `string \| number`                                         | —          |
| `height`       | 高度，数字为 px                 | `string \| number`                                         | —          |
| `fit`          | 填充方式                        | `'fill' \| 'contain' \| 'cover' \| 'none' \| 'scale-down'` | `'cover'`  |
| `lazy`         | 原生懒加载                      | `boolean`                                                  | `false`    |
| `fallback`     | 失败后再试的地址                | `string`                                                   | —          |
| `preview`      | 点击打开预览                    | `boolean`                                                  | `false`    |
| `previewSrc`   | 预览用的大图                    | `string`                                                   | `src`      |
| `previewList`  | 预览里可以切换的一组图片        | `(string \| { src, alt? })[]`                              | —          |
| `previewIndex` | 这张图在 `previewList` 中的位置 | `number`                                                   | 按地址查找 |
| `downloadable` | 预览中显示下载按钮              | `boolean`                                                  | `false`    |

### Image Events

| 名称    | 说明                           | 参数             |
| ------- | ------------------------------ | ---------------- |
| `load`  | 加载完成                       | `(event: Event)` |
| `error` | 加载失败（含 `fallback` 之后） | `(event: Event)` |

### Image Slots

| 名称          | 说明           |
| ------------- | -------------- |
| `placeholder` | 加载中的内容   |
| `error`       | 加载失败的内容 |

### ImagePreview Props

| 名称           | 说明                           | 类型                             | 默认值   |
| -------------- | ------------------------------ | -------------------------------- | -------- |
| `open`         | 是否打开，配合 `v-model:open`  | `boolean`                        | `false`  |
| `images`       | 图片                           | `(string \| { src, alt? })[]`    | `[]`     |
| `index`        | 当前图片，配合 `v-model:index` | `number`                         | `0`      |
| `loop`         | 首尾相接                       | `boolean`                        | `false`  |
| `minScale`     | 最小缩放                       | `number`                         | `0.25`   |
| `maxScale`     | 最大缩放                       | `number`                         | `4`      |
| `closeOnMask`  | 点击图片周围的暗处关闭         | `boolean`                        | `true`   |
| `downloadable` | 显示下载按钮                   | `boolean`                        | `false`  |
| `teleport`     | 渲染到哪里                     | `string \| HTMLElement \| false` | `'body'` |

ImagePreview 触发 `update:open`、`update:index` 与 `close`。
