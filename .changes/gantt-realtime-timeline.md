---
type: 新增
packages: [gantt]
---

`DouGantt` 与 `DouScheduler` 支持分钟/秒级时间精度（含秒、毫秒、带时区偏移 ISO-8601 字符串与 Unix 毫秒时间戳）、`minute`/`second` 亚小时刻度与 `fit([start, end])` 时间窗适配、`:calendar="false"` 关闭工作日历、行/泳道内离散事件标记点（`marker.task`/`marker.resource`、`#marker` 插槽与 `markerClick` 事件），以及 `v-model:follow` 实时跟随与只读拖拽平移。
