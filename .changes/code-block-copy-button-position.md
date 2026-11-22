---
type: 修复
packages: [dou-ui, theme]
---

修复 `DouCodeBlock` 无标题栏时复制按钮被 `.dou-copy-button` 的 `position: relative` 覆盖的问题，提高悬浮定位与过渡规则的优先级，使其稳定停留在代码块右上角。
