---
type: 新增
packages: [dou-ui, theme, code, flow, gantt, sheet, pivot, form-builder, editor]
---

带外框的组件统一新增 `bordered`（默认 `true`），设为 `false` 时去掉边框和圆角，不留透明的 1px，聚焦时也不再画出边框，适合放进已经有边框的卡片或面板：FlowEditor、CodeEditor、CodeDiff、Gantt、Scheduler、Sheet、Pivot、FormBuilder、Table、CodeBlock、QRCode、CalendarView、LayoutFooter。边框颜色统一可以用 `--dou-<组件>-border` 调整。
