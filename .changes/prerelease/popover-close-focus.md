---
type: 修复
packages: [dou-ui]
pr: 310
version: 0.1.0-alpha.3
---

Popover 的 `content` 插槽参数 `close` 与实例方法 `close()` 关闭时把焦点交还给触发元素；Popconfirm 点击取消或确定后同样如此。
