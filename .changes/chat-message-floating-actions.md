---
type: 不兼容
packages: [dou-ui, theme]
---

`DouChatMessage` 的操作改为浮在消息右上角的小浮条，不再占用消息左侧或下方的位置；长消息顶部滚出去时，浮条停在滚动区域顶部。`actions-visible` 的默认值统一为 `'hover'`：鼠标悬停、焦点在消息内时显示，触屏上点一下消息显示、点别处收起。以前助手消息的操作始终显示，想保持这样，设置 `actions-visible="always"`，或在 `defaults` 里给 `DouChatMessage` 设置 `actionsVisible: 'always'`。
