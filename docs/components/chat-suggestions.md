# ChatSuggestions 提示建议

一组可以点击的提示，帮助用户开始对话或继续追问。

## 基础用法

`items` 可以直接传字符串。点击后触发 `select`，参数是建议的值和这一项本身；通常在这里把文字填进输入框，或者直接发送。

<DocDemo src="chat-suggestions/basic" column />

## 卡片

`variant="card"` 显示为卡片，可以带图标和一行描述，适合放在对话开始前的欢迎页。`columns` 固定每行几张，不设置时按宽度自动排列。

<DocDemo src="chat-suggestions/card" column />

## API

### Props

| 名称      | 说明           | 类型                           | 默认值   |
| --------- | -------------- | ------------------------------ | -------- |
| `items`   | 建议列表       | `(string \| ChatSuggestion)[]` | `[]`     |
| `variant` | 样式           | `'chip' \| 'card'`             | `'chip'` |
| `columns` | 卡片每行的数量 | `number`                       | —        |
| `title`   | 列表上方的说明 | `string`                       | —        |

### ChatSuggestion

| 名称          | 说明                               | 类型        |
| ------------- | ---------------------------------- | ----------- |
| `value`       | 传给 `select` 的值，默认为 `label` | `string`    |
| `label`       | 文字                               | `string`    |
| `description` | 卡片中的第二行                     | `string`    |
| `icon`        | 文字前的图标组件                   | `Component` |
| `disabled`    | 禁用                               | `boolean`   |

### Events

| 名称     | 说明       | 参数                                    |
| -------- | ---------- | --------------------------------------- |
| `select` | 点击了一项 | `(value: string, item: ChatSuggestion)` |

### Slots

| 名称    | 说明                                |
| ------- | ----------------------------------- |
| `item`  | 替换每一项的内容，参数为 `{ item }` |
| `title` | 替换说明                            |
