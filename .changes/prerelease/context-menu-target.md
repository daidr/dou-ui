---
type: 新增
packages: [dou-ui]
pr: 309
version: 0.1.0-alpha.3
---

ContextMenu 新增 `v-model:target` 和 `beforeOpen`：每次右键开始时先清空 `target`，由项的事件重新记下；`beforeOpen` 返回 `false` 时不打开，比如右键分组标题、表头或空隙时，右键交还给浏览器或外层的 ContextMenu。触发区域里的元素已经处理了这次右键（调用过 `preventDefault()`）时也不再打开，嵌套的 ContextMenu 只打开里面那个。
