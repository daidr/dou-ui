---
type: 修复
packages: [dou-ui]
---

修复 `DouAutocomplete`、`DouSelect`、`DouCascader`、`DouDatePicker`、`DouTimePicker`、`DouTreeSelect`、`DouColorPicker`、`DouInputDate`、`DouInputTime` 及浮层与多根组件因 Fragment / Teleport 根结构丢失父组件 `scopeId` 与 `slotScopeIds` 的问题，使调用方在 `<style scoped>` 中直接传入的 class 能够正常命中目标元素，无需额外包一层容器或使用 `:deep()`。
