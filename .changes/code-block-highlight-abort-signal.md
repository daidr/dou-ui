---
type: 新增
packages: [dou-ui]
---

`DouCodeBlock` 的 `highlight` 回调支持接收可选的第三个参数 `{ signal: AbortSignal }`，在代码、语言、高亮函数变化或组件卸载时自动中止上一轮高亮信号，便于异步高亮器（如 Web Worker 池）及时取消排队中的过期任务。
