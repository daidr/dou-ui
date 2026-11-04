---
type: 新增
packages: [dou-ui, theme]
pr: 306
version: 0.1.0-alpha.3
---

ChatConfirm 和 ChatToolCall 新增 `withdrawn` 状态，表示用户回答之前助手已经不需要了，比如生成被停止或助手换了做法。ChatConfirm 收起为一行“已撤回”，图标和文字整体变淡，不再使用 `tone` 的颜色；ChatToolCall 显示“已撤回”。语言包新增 `chat.withdrawn` 和 `chat.toolWithdrawn`。

ChatConfirm 回答或撤回后，如果焦点原本在它的按钮上，会留在卡片上而不是丢到页面；结果行一直挂载，读屏软件能播报新的结果。
