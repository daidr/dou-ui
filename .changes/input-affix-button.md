---
type: 新增
packages: [dou-ui, theme]
---

DouInput 和 DouInputNumber 的前缀、后缀里可以放 DouButton 或 DouCopyButton：按钮的高度跟随输入框尺寸，随输入框一起禁用；按钮位于最前或最后时，它的底色与输入框上、下和该侧边框的距离相同，聚焦环也落在这段距离之内。这段距离可用 `--dou-input-action-inset`、`--dou-input-number-action-inset` 调整，默认 2px。触屏上这类按钮上下方向至少有 40px 的点按范围。
