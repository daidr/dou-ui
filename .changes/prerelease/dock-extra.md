---
type: 新增
packages: [dou-ui]
pr: 380
version: 0.1.0-alpha.9
---

DouDock 新增 `extra` 插槽，放在每组标签行的末尾，参数是这一组和它选中的标签；新增 `v-model:active-group`，记着最近用过的组：在某组里按下指针、焦点移进某组，或者把标签拖进某组、拆出新组时更新，这一组从布局里消失时变回 `undefined`。
