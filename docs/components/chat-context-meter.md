# ChatContextMeter 上下文用量

一个小圆环，显示对话已经占用了多少模型上下文，通常放在输入框底部。

## 基础用法

`used` 是已用的 token 数，`total` 是上限。超过 80% 时圆环变成警告色，超过 95% 时变成危险色，阈值可以用 `warnAt` 和 `dangerAt` 调整。`showLabel` 会在圆环旁显示百分比。

<DocDemo src="chat-context-meter/basic" />

## 提示和用量明细

圆环本身只负责显示，不带提示，也不单独获得焦点。具体数字放在哪里、写成什么样，由应用自己组合。常见的写法是把圆环放进一个 ghost 按钮：悬停或聚焦时用 DouTooltip 显示一行数字，点击时用 DouPopover 打开这个会话的用量明细。

<DocDemo src="chat-context-meter/detail" />

- 按钮需要 `aria-label`，读屏会读出按钮的名称。圆环在按钮里只是装饰。
- 提示里的数字可以用 `compactNumber` 写，和圆环读给读屏的数字一致（`45200` 写成 `45.2k`）。文案 `chat.context` 也可以通过 `useLocale().t` 取用。
- 按钮里的圆环按图标处理，按钮是方形的。想同时显示百分比时，不要用 `showLabel`，而是把圆环放进按钮的 `leading` 插槽，把百分比写成按钮文字。
- 圆环直接作为 DouTooltip 的触发器、不套按钮时，要加 `tabindex="0"`，键盘才能聚焦到它。

## 无障碍

圆环的 `role` 是 `meter`，带有 `aria-valuenow`，`aria-valuetext` 是“上下文已用 45.2k / 200k（23%）”这样的完整读法。默认名称是“上下文用量”，传入 `aria-label` 可以替换。

## API

### Props

| 名称        | 说明               | 类型      | 默认值  |
| ----------- | ------------------ | --------- | ------- |
| `used`      | 已用数量           | `number`  | `0`     |
| `total`     | 上限               | `number`  | `0`     |
| `warnAt`    | 变为警告色的比例   | `number`  | `0.8`   |
| `dangerAt`  | 变为危险色的比例   | `number`  | `0.95`  |
| `showLabel` | 在圆环旁显示百分比 | `boolean` | `false` |

### 函数

| 名称            | 说明                                             | 类型                        |
| --------------- | ------------------------------------------------ | --------------------------- |
| `compactNumber` | 把数字写成紧凑形式，如 `45200` → `45.2k`、`1.2M` | `(value: number) => string` |
