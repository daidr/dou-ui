# ChatList 消息列表

对话消息的滚动容器，新消息到达和文字流式输出时自动保持在底部。

## 基础用法

把 [ChatBubble](./chat-bubble) 放进默认插槽，并给列表一个高度。列表停在底部时，内容变高会自动跟着滚动；用户往上翻看时停止跟随，右下角出现回到底部的按钮，回到底部后重新开始跟随。

<DocDemo src="chat-list/basic" column />

## 加载更早的消息

滚动到顶部时触发 `topReached`，可以在这时请求更早的消息并插入到列表前面。每次到达顶部只触发一次，离开后再回来才会再次触发。

## 大量消息

消息很多时，把数据传给 `items`，用 `item` 插槽渲染每一条，列表只渲染看得见的消息。每条消息的高度按渲染后的实际高度计算，`estimate-size` 是还没渲染过的消息的估算高度。在前面插入更早的消息时，看到的内容保持不动。

<DocDemo src="chat-list/many" column />

## 读屏

滚动区域带 `role="log"` 和 `tabindex="0"`，可以用键盘聚焦后上下滚动。

## API

### Props

| 名称               | 说明                                 | 类型                                                     | 默认值 |
| ------------------ | ------------------------------------ | -------------------------------------------------------- | ------ |
| `autoScroll`       | 停在底部时随新内容自动滚动           | `boolean`                                                | `true` |
| `threshold`        | 距离底部多少像素以内算作在底部       | `number`                                                 | `24`   |
| `showScrollButton` | 离开底部时显示回到底部按钮           | `boolean`                                                | `true` |
| `items`            | 消息数据，传入后只渲染看得见的消息   | `T[]`                                                    | —      |
| `itemKey`          | 唯一键所在的属性，或返回唯一键的函数 | `string \| (item: T, index: number) => string \| number` | 下标   |
| `estimateSize`     | 未渲染消息的估算高度（px）           | `number \| (item: T, index: number) => number`           | `120`  |

### Events

| 名称              | 说明               | 参数                  |
| ----------------- | ------------------ | --------------------- |
| `update:atBottom` | 是否在底部发生变化 | `(atBottom: boolean)` |
| `topReached`      | 滚动到顶部         | —                     |

### Slots

| 名称      | 说明                                                |
| --------- | --------------------------------------------------- |
| `default` | 消息                                                |
| `item`    | 传入 `items` 时的一条消息，参数为 `{ item, index }` |
| `button`  | 替换回到底部按钮，参数为 `{ scrollToBottom }`       |

### Exposes

| 名称             | 说明                     | 类型                                  |
| ---------------- | ------------------------ | ------------------------------------- |
| `viewport`       | 滚动的元素               | `HTMLElement \| null`                 |
| `scrollToBottom` | 滚动到底部并重新开始跟随 | `(behavior?: ScrollBehavior) => void` |
| `atBottom`       | 当前是否在底部           | `boolean`                             |
