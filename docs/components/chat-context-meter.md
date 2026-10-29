# ChatContextMeter 上下文用量

一个小圆环，显示对话已经占用了多少模型上下文，通常放在输入框底部。

## 基础用法

`used` 是已用的 token 数，`total` 是上限。超过 80% 时圆环变成警告色，超过 95% 时变成危险色，阈值可以用 `warn-at` 和 `danger-at` 调整。具体数字在悬停提示里，`show-label` 会在圆环旁显示百分比。

<DocDemo src="chat-context-meter/basic" />

## API

### Props

| 名称        | 说明               | 类型                        | 默认值     |
| ----------- | ------------------ | --------------------------- | ---------- |
| `used`      | 已用数量           | `number`                    | `0`        |
| `total`     | 上限               | `number`                    | `0`        |
| `format`    | 提示里数字的格式   | `(value: number) => string` | 如 `45.2k` |
| `warnAt`    | 变为警告色的比例   | `number`                    | `0.8`      |
| `dangerAt`  | 变为危险色的比例   | `number`                    | `0.95`     |
| `showLabel` | 在圆环旁显示百分比 | `boolean`                   | `false`    |
