---
type: 新增
packages: [dou-ui, theme]
---

`DouChatMessage` 新增回应：`reactions` 在消息下方显示表情和人数，自己回应过的一项带主题色，点击触发 `react`（参数为表情和对应的那一项），由应用加上或收回。提供 `reaction-picker` 插槽后出现“添加回应”按钮，弹出层里放什么由应用决定；还没有回应时按钮在操作里，有了回应后跟在回应末尾。`reaction` 插槽可以把表情渲染成图片。
