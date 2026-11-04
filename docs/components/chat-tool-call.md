# ChatToolCall 工具调用

显示模型的一次工具调用：调用了什么、进行到哪一步，以及参数和结果。

## 基础用法

`name` 是工具名，用等宽字体显示；也可以用 `title` 换成一句更好读的说明。`status` 的前五种含义和 [ChatPlan](./chat-plan) 一致：`pending` 未开始、`running` 运行中、`waiting` 等待中、`done` 已完成、`error` 失败；另有 `withdrawn` 已撤回，和 [ChatConfirm](./chat-confirm) 一致。`waiting` 表示调用停下来等别人，比如等用户允许，与尚未开始的 `pending` 不同。

传了 `input` 或 `output` 时，点击标题可以展开查看。对象会格式化成 JSON，字符串原样显示。

<DocDemo src="chat-tool-call/basic" column />

## 等待确认

有些操作需要用户同意后才能执行，这时把 `status` 设为 `waiting`。`actions` 插槽显示在卡片底部，不需要展开就能看到，可以放允许和拒绝按钮。用户还没回答，助手就不再需要执行这个调用时（比如用户停止了生成），把 `status` 设为 `withdrawn`，表示它没有执行过。已经开始执行、中途被停止的调用不属于撤回，保持原来的状态即可。

<DocDemo src="chat-tool-call/waiting" column />

## API

### Props

| 名称     | 说明                          | 类型                                                                      | 默认值   |
| -------- | ----------------------------- | ------------------------------------------------------------------------- | -------- |
| `name`   | 工具名                        | `string`                                                                  | —        |
| `title`  | 代替工具名显示的说明          | `string`                                                                  | —        |
| `status` | 状态                          | `'pending' \| 'running' \| 'waiting' \| 'done' \| 'error' \| 'withdrawn'` | `'done'` |
| `input`  | 调用参数                      | `unknown`                                                                 | —        |
| `output` | 返回结果或错误信息            | `unknown`                                                                 | —        |
| `open`   | 是否展开，配合 `v-model:open` | `boolean`                                                                 | —        |

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
| `actions` | 卡片底部的操作，始终显示   |
