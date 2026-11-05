---
type: 新增
packages: [dou-ui, theme]
pr: 345
version: 0.1.0-alpha.4
---

`DouImage` 新增 `max-width` 和 `max-height`，限制盒子的最大宽高。不传 `width` 和 `height` 时，图片按原始比例等比缩小到上限以内，不会被裁剪。加载中和加载失败时，盒子使用这两个上限作为尺寸。

不传尺寸的 `DouImage` 现在默认不超过容器宽度，盒子大小与图片一致，不再被 flex 或 grid 父元素拉伸。
