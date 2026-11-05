---
type: 改进
packages: [code]
---

DouCodeEditor 和 DouCodeDiff 行号栏里可点的列，在触屏和触控笔上改为手指抬起且没有移动时才触发 `onPress`，从行号栏开始拖动只滚动，不会误触。点一个还看不见的悬停标记时，第一下先把光标移到这一行让标记出现，再点一下才触发。
