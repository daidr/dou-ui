# Marquee 跑马灯

让一组内容循环滚动，用于公告、合作方列表或标签墙。

## 基础用法

内容会被复制若干份首尾相接，循环时看不到接缝。鼠标悬停或焦点在内部时暂停，两端渐隐。

<DocDemo src="marquee/basic" column />

## 速度与方向

`speed` 是每秒移动的像素数，内容长短不影响速度。`reverse` 改为向右（纵向时向下）移动，`gap` 是相邻两份内容之间的距离。

<DocDemo src="marquee/tags" column />

## 纵向

`direction="vertical"` 时需要给组件一个高度。`paused` 可以由外部控制暂停。

<DocDemo src="marquee/vertical" column />

## 可访问性

只有第一份内容会被读屏读到，复制出来的部分带有 `aria-hidden` 和 `inert`，也不会进入 `Tab` 顺序。系统开启"减弱动态效果"时停止滚动，内容可以手动横向滚动查看。

## API

### Props

| 名称           | 说明                        | 类型                         | 默认值         |
| -------------- | --------------------------- | ---------------------------- | -------------- |
| `direction`    | 滚动方向                    | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `speed`        | 速度，单位 px/s             | `number`                     | `40`           |
| `reverse`      | 反向移动                    | `boolean`                    | `false`        |
| `gap`          | 相邻两份内容的间距，单位 px | `number`                     | `32`           |
| `pauseOnHover` | 悬停或内部有焦点时暂停      | `boolean`                    | `true`         |
| `paused`       | 暂停                        | `boolean`                    | `false`        |
| `fade`         | 两端渐隐                    | `boolean`                    | `true`         |

### Slots

| 名称      | 说明     |
| --------- | -------- |
| `default` | 滚动内容 |

### CSS 变量

| 名称                 | 说明         | 默认值 |
| -------------------- | ------------ | ------ |
| `--dou-marquee-fade` | 渐隐区域宽度 | `48px` |
