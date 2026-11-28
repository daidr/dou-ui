---
type: 新增
packages: [gantt]
---

`DouScheduler` 与 `DouGantt` 补齐实时监控画布集成能力：新增 `viewportChange` 事件、`getViewport()`/`xOf()`/`timeAt()` 视口与坐标换算、`v-model:tableWidth` 列宽双向同步及分隔线/平移拖拽全局防选区、外部校准时钟 `now`、`GanttMarker.endDate` 区间底纹渲染与导出、`GanttTask.class` / `#bar-content` / `#bar-tooltip` / `#marker-tooltip` / `nativeTitle`；`DouScheduler` 同步支持 `barLabel`、泳道行点击（`resourceClick`、`v-model:selectedResource`、`rowClass`）、可控分组折叠（`v-model:collapsedGroups`、`#group`）、顶部辅助轨道（`#rail` / `#rail-header` / `railHeight`）、画布扩展图层（`#underlay` / `#overlay`）、`rowBox()`/`barBox()` 与 `useScheduler()` 上下文。
