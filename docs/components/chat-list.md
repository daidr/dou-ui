# ChatList 消息列表

对话消息的滚动容器，新消息到达和文字流式输出时自动保持在底部。

## 基础用法

把 [ChatBubble](./chat-bubble) 放进默认插槽，并给列表一个高度。列表停在底部时，内容变高会自动跟着滚动；用户往上翻看时停止跟随，右下角出现回到底部的按钮，回到底部后重新开始跟随。

<DocDemo src="chat-list/basic" column />

## 加载更早的消息

滚动到顶部时触发 `topReached`，可以在这时请求更早的消息并插入到列表前面。插入后原来的第一条消息停在原处，不会跳到新插入的消息上。每次到达顶部只触发一次，离开后再回来才会再次触发。在手机上，`topReached` 等手指离开、回弹结束后才触发。

## 大量消息

消息很多时，把数据传给 `items`，用 `item` 插槽渲染每一条，列表只渲染看得见的消息。每条消息的高度按渲染后的实际高度计算，`estimateSize` 是还没渲染过的消息的估算高度。在前面插入更早的消息时，看到的内容保持不动。

<DocDemo src="chat-list/many" column />

## 定位到某条消息

`scrollToMessage` 直接跳到一条消息，把它放在视野中间，比如搜索点中的那一条。传了 `items` 时，参数是这条消息的键（`itemKey` 给出的值，没有 `itemKey` 时是下标）；用默认插槽时，传它的元素，或者绑在 DouChatMessage 上的 `ref`：

```vue
<script setup>
import { ref } from 'vue'

const list = ref()
// 每条消息的组件，按 id 存放；消息移除时 ref 收到 null，一并删掉
const refs = {}
const keep = (id, c) => (c ? (refs[id] = c) : delete refs[id])
</script>

<template>
  <DouChatList ref="list">
    <DouChatMessage v-for="m in messages" :key="m.id" :ref="(c) => keep(m.id, c)" v-bind="m" />
  </DouChatList>
</template>
```

```ts
list.value.scrollToMessage(refs[id])
```

两种写法都是直接跳过去，不做平滑滚动：虚拟列表要等消息渲染出来才知道它的确切位置。找不到的键、不在列表里的元素，以及 `null`、`undefined`（比如已经移除的消息的 `ref`）都会被忽略，列表保持原样。

跳过去之后列表停止跟随新内容，免得新消息把读者拉回底部；定位到最后几条、列表已经在底部时，会照常继续跟随。

配合 DouChatMessage 的 `highlighted` 短暂高亮，让读者看出是哪一条。高亮的消息带 `aria-current="true"`；焦点不会移动，读屏用户需要的提示（比如“已定位到第 7 条”）由应用自己播报。

<DocDemo src="chat-list/locate" column />

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

| 名称             | 说明               | 参数                  |
| ---------------- | ------------------ | --------------------- |
| `atBottomChange` | 是否在底部发生变化 | `(atBottom: boolean)` |
| `topReached`     | 滚动到顶部         | —                     |

### Slots

| 名称      | 说明                                                |
| --------- | --------------------------------------------------- |
| `default` | 消息                                                |
| `item`    | 传入 `items` 时的一条消息，参数为 `{ item, index }` |
| `button`  | 替换回到底部按钮，参数为 `{ scrollToBottom }`       |

### Exposes

| 名称              | 说明                                                                                                                                   | 类型                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewport`        | 滚动的元素                                                                                                                             | `HTMLElement \| null`                                                                                                                                |
| `scrollToBottom`  | 滚动到底部并重新开始跟随                                                                                                               | `(behavior?: ScrollBehavior) => void`                                                                                                                |
| `scrollToMessage` | 直接跳到一条消息并停止跟随；传了 `items` 时传键，否则传元素或 DouChatMessage 的 `ref`；找不到或传 `null` 时忽略；`align` 默认 `center` | `(target: VirtualListKey \| HTMLElement \| ComponentPublicInstance \| null \| undefined, align?: 'start' \| 'center' \| 'end' \| 'nearest') => void` |
| `atBottom`        | 当前是否在底部                                                                                                                         | `boolean`                                                                                                                                            |
