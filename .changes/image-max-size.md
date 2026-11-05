---
type: 新增
packages: [dou-ui, theme]
---

`DouImage` 新增 `max-width` 和 `max-height`：不传宽高时图片按原始比例显示，整体缩小到上限以内而不是被裁掉，盒子跟着图片走，不会被 flex 或 grid 父元素拉伸；加载中和加载失败时盒子按上限显示。
