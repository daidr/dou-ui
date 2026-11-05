---
type: 改进
packages: [dou-ui]
---

DouChatList 的 `scrollToMessage` 传 `null` 或 `undefined`（比如已经移除的消息的 `ref`）时直接忽略，不再提示“只有 `items` 时才能传键”；文档里默认插槽的写法补上了 `refs` 的定义和移除时的清理。参数类型从 `HTMLElement` 放宽为 `Element`，函数 `ref` 拿到的值可以直接传入，TypeScript 不再报错。
