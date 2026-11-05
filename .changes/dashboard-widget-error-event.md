---
type: 新增
packages: [dashboard]
---

DouDashboard 新增 `widgetError` 事件：格子的内容或设置面板出错时触发，参数是 `{ widget, part, error }`，用来上报错误监控。`@dou-ui/dashboard/widgets` 导出 `textOf`、`textsOf`、`numberOf`、`flagOf`、`recordOf`，自定义格子可以用它们读取类型不可靠的 `props`。
