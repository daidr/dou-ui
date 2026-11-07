---
type: 新增
packages: [dou-ui]
---

DouDock 新增实例方法 `startDrag`：在列表项等外部元素的 `pointerdown` 里调用，就能把它当作标签拖进 Dock，放到标签行、中间或边缘的效果和拖标签相同，`move`、`split` 的 `from` 为 `null` 表示新开。
