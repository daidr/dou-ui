---
type: 新增
packages: [dou-ui, theme]
---

`DouChatMessage` 新增 `status` 属性与 `status` 插槽：用户消息在 `sending` 时于气泡（或纯附件区）左侧下方显示加载指示并隐藏右上角操作栏，`sent` 后平滑消失，`error` 时在同一位置显示失败图标；通过 `status` 插槽可自定义状态指示或重试入口。
