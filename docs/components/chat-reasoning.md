# ChatReasoning 思考过程

可折叠的思考过程，显示在回答前面。

## 基础用法

`thinking` 为 `true` 时标题显示“正在思考”并带有扫光效果，面板自动展开；结束后标题变为“已思考 N 秒”，面板自动收起。用户可以随时点击标题展开或收起。

思考内容放在默认插槽里，可以配合 [StreamText](./stream-text) 逐字显示。

<DocDemo src="chat-reasoning/basic" column />

## 已完成的思考

`duration` 直接指定用了多少秒，适合显示历史消息；不传时组件会记录 `thinking` 从开始到结束的时间。`title` 可以换成别的说明。

<DocDemo src="chat-reasoning/done" column />

## 展开状态

用 `v-model:open` 可以自己控制展开。`auto-collapse` 设为 `false` 时，思考结束后保持展开。

## API

### Props

| 名称           | 说明                          | 类型      | 默认值  |
| -------------- | ----------------------------- | --------- | ------- |
| `thinking`     | 是否正在思考                  | `boolean` | `false` |
| `duration`     | 思考用了多少秒                | `number`  | —       |
| `open`         | 是否展开，配合 `v-model:open` | `boolean` | —       |
| `autoCollapse` | 思考结束后自动收起            | `boolean` | `true`  |
| `title`        | 替换标题文字                  | `string`  | —       |

### Events

| 名称          | 说明         | 参数              |
| ------------- | ------------ | ----------------- |
| `update:open` | 展开状态变化 | `(open: boolean)` |

### Slots

| 名称      | 说明                                      |
| --------- | ----------------------------------------- |
| `default` | 思考内容                                  |
| `title`   | 替换标题，参数为 `{ thinking, duration }` |
