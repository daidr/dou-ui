---
type: 修复
packages: [dou-ui]
---

修复 `DouChatList` 与 `DouVirtualList` 在 iOS Safari 等触屏或小步长滚动场景中停在底部时向上滑动被反复弹回最底部的问题：补充触屏方向检测与活跃触控期保护、修正 `threshold` 区域内与底部橡皮筋回弹时的自动吸底状态判断，并将 `useMeasuredSizes` 的高度测量改为精确盒高度以消除虚拟列表 spacer 亚像素抖动。
