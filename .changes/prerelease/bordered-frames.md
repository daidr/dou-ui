---
type: 新增
packages: [dou-ui, theme, code, flow, gantt, sheet, pivot, form-builder, editor]
pr: 301
version: 0.1.0-alpha.3
---

带外框的组件统一新增 `bordered`（默认 `true`），设为 `false` 时去掉边框和圆角，不留透明的 1px，聚焦时也不再画出边框，适合放进已经有边框的卡片或面板：FlowEditor、CodeEditor、CodeDiff、Gantt、Scheduler、Sheet、Pivot、FormBuilder、Table、CodeBlock、QRCode、CalendarView、LayoutFooter。边框颜色可以统一用 `--dou-<组件>-border` 调整，ColorPanel 新增 `--dou-color-panel-border`，LayoutHeader、LayoutAside、LayoutFooter 的分隔线分别新增 `--dou-layout-header-border`、`--dou-layout-aside-border`、`--dou-layout-footer-border`。
