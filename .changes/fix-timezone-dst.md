---
type: 修复
packages: [dou-ui, chart, pivot, form-builder, dashboard, sheet]
---

修复各时间相关组件在跨时区与夏令时切换时的偏移与精度问题：`@dou-ui/chart` 修复跨夏令时日/小时刻度漂移、秋季回拨重复小时重叠及带时区 ISO 时间轴推断，并对歧义重复时刻补充短时区标识；`dou-ui` 修复 `DouRelativeTime` 对无时区日期与日期时间字符串的本地解析、`DouDatePicker` / `DouCalendarView` / `DouCalendarHeatmap` 的跨午夜读表竞态及 0–99 年构造偏移；`@dou-ui/pivot` 修复无时区日期字符串分桶偏移、Worker 序列化回传格式、自定义标签格式化与日期导出格式；`@dou-ui/form-builder` 修复 `days()` / `today()` 跨时区及跨夏令时计算偏差，以及只读模式 `formatDate` 对 `Date` 实例和带时区 ISO 字符串的支持；`@dou-ui/dashboard` 修复图表点击联动筛选与高亮丢弃时间精度及混淆夏令时重复小时的问题；`@dou-ui/sheet` 修复 0–99 年日期格式与按月续填偏差。
