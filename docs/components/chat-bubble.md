# ChatBubble 消息气泡

对话中的一条消息。

## 基础用法

`placement` 决定消息靠哪边：对方的消息用默认的 `start`，自己的消息用 `end`。`content` 传纯文字，换行会保留；需要更复杂的内容时使用默认插槽。

`avatar` 传图片地址显示头像，传 `true` 时用 `name` 的首字；`avatar` 插槽可以换成任意内容，比如带图标的 [Avatar](./avatar)。

<DocDemo src="chat-bubble/basic" column />

## 样式

`variant` 有三种：`soft` 浅色底，`outline` 带边框，`ghost` 不画气泡。较长的回答适合用 `ghost`，读起来和正文一样。

<DocDemo src="chat-bubble/variant" column />

## 加载中

`loading` 时用三个跳动的圆点代替内容，表示回复正在生成。

<DocDemo src="chat-bubble/loading" column />

## 底部操作

`footer` 插槽显示在气泡下方，适合放复制、重新生成、反馈这类操作。加载中不显示。

<DocDemo src="chat-bubble/footer" column />

## 系统消息

`placement="center"` 用于系统提示，比如有人加入对话、时间分隔，居中显示为一行小字，不显示头像。

<DocDemo src="chat-bubble/center" column />

## API

### Props

| 名称        | 说明                                      | 类型                             | 默认值    |
| ----------- | ----------------------------------------- | -------------------------------- | --------- |
| `placement` | 消息的位置                                | `'start' \| 'end' \| 'center'`   | `'start'` |
| `variant`   | 样式                                      | `'soft' \| 'outline' \| 'ghost'` | `'soft'`  |
| `content`   | 纯文字内容，默认插槽会替换它              | `string`                         | —         |
| `name`      | 发送者，显示在气泡上方，也用于头像首字    | `string`                         | —         |
| `time`      | 发送时间，显示在名字后面                  | `string`                         | —         |
| `avatar`    | 头像图片地址，`true` 时显示 `name` 的首字 | `string \| boolean`              | —         |
| `loading`   | 显示加载中的圆点                          | `boolean`                        | `false`   |

### Slots

| 名称      | 说明                     |
| --------- | ------------------------ |
| `default` | 消息内容                 |
| `avatar`  | 替换头像                 |
| `header`  | 替换气泡上方的名字和时间 |
| `footer`  | 气泡下方的操作或说明     |
