# ChatToolCall 工具调用

显示模型的一次工具调用：调用了什么、进行到哪一步，以及参数和结果。

## 基础用法

`name` 是工具名，用等宽字体显示；也可以用 `title` 换成一句更好读的说明。`status` 有四种：`pending` 等待确认、`running` 运行中、`success` 已完成、`error` 失败。

传了 `input` 或 `output` 时，点击标题可以展开查看。对象会格式化成 JSON，字符串原样显示。

<DocDemo src="chat-tool-call/basic" column />

## 等待确认

有些操作需要用户同意后才能执行。`actions` 插槽显示在标题下方，不需要展开就能看到，可以放允许和拒绝按钮。

<DocDemo src="chat-tool-call/pending" column />

## API

### Props

| 名称     | 说明                          | 类型                                             | 默认值      |
| -------- | ----------------------------- | ------------------------------------------------ | ----------- |
| `name`   | 工具名                        | `string`                                         | —           |
| `title`  | 代替工具名显示的说明          | `string`                                         | —           |
| `status` | 状态                          | `'pending' \| 'running' \| 'success' \| 'error'` | `'success'` |
| `input`  | 调用参数                      | `unknown`                                        | —           |
| `output` | 返回结果或错误信息            | `unknown`                                        | —           |
| `open`   | 是否展开，配合 `v-model:open` | `boolean`                                        | —           |

### Events

| 名称          | 说明         | 参数              |
| ------------- | ------------ | ----------------- |
| `update:open` | 展开状态变化 | `(open: boolean)` |

### Slots

| 名称      | 说明                       |
| --------- | -------------------------- |
| `icon`    | 替换工具图标               |
| `title`   | 替换标题                   |
| `input`   | 替换参数部分               |
| `output`  | 替换结果部分               |
| `default` | 展开后在结果下方的其他内容 |
| `actions` | 标题下方的操作，始终显示   |
