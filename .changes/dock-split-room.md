---
type: 改进
packages: [dou-ui]
---

DouDock 的组放不下两个 `min` 时，拖到这个方向的边缘不再拆分，而是和拖到中间一样并入这一组；`min` 可以写成 `{ width, height }`，左右分割和上下分割分别用；新增实例方法 `canSplit(groupId, side)`，用按钮拆分时可以先判断放不放得下。
