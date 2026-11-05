---
type: 新增
packages: [dou-ui, theme]
pr: 346
version: 0.1.0-alpha.4
---

`DouChatMessage` 新增 `highlighted`，用主题色描边框住这条消息，并带 `aria-current="true"`；关掉后淡出，减少动效时很快消失。

`DouChatList` 新增 `scrollToMessage`，直接跳到一条消息并停止跟随新内容，适合搜索定位。传了 `items` 时按键值定位，否则传元素或 DouChatMessage 的 `ref`。
