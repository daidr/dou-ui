# Carousel 轮播

在同一块区域里依次展示一组内容，可以手动切换，也可以自动播放。

## 基础用法

每张用一个 `DouCarouselItem` 包起来。默认循环，鼠标悬停时显示两侧箭头，底部的指示条可以直接跳到某一张。也可以用方向键切换，或者用鼠标、手指拖动。

<DocDemo src="carousel/basic" column />

没有设置 `height` 时，轮播的高度跟随当前这一张。

## 自动播放

`autoplay` 每隔 `interval` 毫秒切到下一张。鼠标悬停、焦点在轮播里、页面切到后台，或者系统开启了“减弱动态效果”时都会暂停。自动播放时会显示一个暂停按钮，读屏用户也可以停下来。

`v-model` 绑定当前这一张的序号。`indicators="outside"` 把指示条放到内容下方。

<DocDemo src="carousel/autoplay" column />

## 纵向

`direction="vertical"` 上下切换，需要设置固定的 `height`。指示条竖排在右侧，方向键改为上下。

<DocDemo src="carousel/vertical" column />

## 淡入淡出与不循环

`effect="fade"` 在原地切换。`loop` 设为 `false` 时，到了第一张或最后一张对应的箭头不可用。

<DocDemo src="carousel/fade" column />

## 可访问性

- 外层带 `aria-roledescription="carousel"`，可以用 `label` 命名；每一张是 `role="group"` 并标明“第几张，共几张”。
- 看不见的几张设置了 `inert`，`Tab` 不会进入。
- 不自动播放时，切换内容通过 `aria-live="polite"` 通知读屏；自动播放时关闭通知，避免不停打断。

## API

### Carousel Props

| 名称         | 说明                             | 类型                              | 默认值         |
| ------------ | -------------------------------- | --------------------------------- | -------------- |
| `modelValue` | 当前这一张的序号，配合 `v-model` | `number`                          | `0`            |
| `direction`  | 切换方向                         | `'horizontal' \| 'vertical'`      | `'horizontal'` |
| `effect`     | 切换效果                         | `'slide' \| 'fade'`               | `'slide'`      |
| `loop`       | 最后一张之后回到第一张           | `boolean`                         | `true`         |
| `autoplay`   | 自动播放                         | `boolean`                         | `false`        |
| `interval`   | 自动播放的间隔（毫秒）           | `number`                          | `4000`         |
| `indicators` | 指示条的位置                     | `'inside' \| 'outside' \| 'none'` | `'inside'`     |
| `arrows`     | 箭头何时显示                     | `'hover' \| 'always' \| 'never'`  | `'hover'`      |
| `draggable`  | 允许拖动切换                     | `boolean`                         | `true`         |
| `height`     | 固定高度，如 `'240px'`           | `string`                          | 跟随当前这一张 |
| `label`      | 读屏使用的名称                   | `string`                          | `'轮播'`       |

### Carousel Events

| 名称                | 说明           | 参数                                |
| ------------------- | -------------- | ----------------------------------- |
| `update:modelValue` | 切换后触发     | `(index: number)`                   |
| `change`            | 当前这一张变化 | `(index: number, previous: number)` |

### Carousel Exposes

| 名称          | 说明         |
| ------------- | ------------ |
| `goTo(index)` | 切到指定一张 |
| `next()`      | 下一张       |
| `prev()`      | 上一张       |

### CarouselItem Props

| 名称    | 说明           | 类型     | 默认值               |
| ------- | -------------- | -------- | -------------------- |
| `label` | 读屏使用的名称 | `string` | `'第 n 张，共 m 张'` |

### CarouselItem Slots

| 名称      | 说明 | 参数                                 |
| --------- | ---- | ------------------------------------ |
| `default` | 内容 | `{ active: boolean, index: number }` |
