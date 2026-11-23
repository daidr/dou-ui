---
type: 修复
packages: [dou-ui]
pr: 520
version: 0.1.0-alpha.23
---

修复 `DouChatList`、`DouVirtualList` 与 `useTouchScroll` 在 iOS 触摸滑动或顶部回弹期间异步加载顶部历史消息时滚动锚定失效、补偿被误判丢弃、重复触发 `topReached` 以及变高消息测量与 `scrollTop` 失步导致连锁上跳的问题。
