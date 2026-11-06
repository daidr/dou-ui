# ChatContextMeter 上下文用量

一个小圆环，显示对话已经占用了多少模型上下文，通常放在输入框底部。

## 基础用法

`used` 是已用的 token 数，`total` 是上限。超过 80% 时圆环变成警告色，超过 95% 时变成危险色，阈值可以用 `warnAt` 和 `dangerAt` 调整。`showLabel` 会在圆环旁显示百分比。圆环的底色轨道始终完整可见，进度两端是平的，用量很低时也不会看起来像正在加载。

<DocDemo src="chat-context-meter/basic" />

## 提示和用量明细

圆环本身只负责显示，不带提示，也不单独获得焦点。具体数字放在哪里、写成什么样，由应用自己组合。常见的写法是把圆环放进一个 ghost 按钮：悬停或聚焦时用 DouTooltip 显示一行数字，点击时用 DouPopover 打开这个会话的用量明细。

<DocDemo src="chat-context-meter/detail" />

- 把那一行数字直接作为按钮的 `aria-label`：按钮的子元素不会被读屏单独读出，圆环在按钮里只起显示作用，数字要靠按钮的名称读出来。提示和名称相同时，提示不会再读一遍。
- 数字用 `contextUsage(used, total)` 算，和圆环同一口径：超过上限时是 100%，没有上限时是 0%；再用 `compactNumber` 写成 `45.2k` 这样的形式。文案 `chat.context` 可以通过 `useLocale().t` 取用。
- 触屏上不显示悬停提示，手机用户要靠点击打开的 Popover 看到数字，所以弹层里也放上这一行。
- 圆环作为按钮唯一的内容时会被当作图标，按钮显示为方形。想同时显示百分比时，不要用 `showLabel`，而是把圆环放进按钮的 `leading` 插槽，把百分比写成按钮文字（在方形按钮里用 `showLabel` 时，开发环境下会提示）。

圆环也可以不套按钮，直接作为 DouTooltip 的触发器，这时要加 `tabindex="0"` 键盘才能聚焦到它；触屏上不会显示这个提示。点击打开的 DouPopover、DouDropdown 必须把圆环放进按钮，圆环本身不响应 Enter 和空格。

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

| 名称            | 说明                                             | 类型                                            |
| --------------- | ------------------------------------------------ | ----------------------------------------------- |
| `compactNumber` | 把数字写成紧凑形式，如 `45200` → `45.2k`、`1.2M` | `(value: number) => string`                     |
| `contextUsage`  | 按圆环的口径算出用量；负数和非有限数按 0 算      | `(used: number, total: number) => ContextUsage` |

### ContextUsage

| 名称      | 说明                                      | 类型     |
| --------- | ----------------------------------------- | -------- |
| `used`    | 已用数量                                  | `number` |
| `total`   | 上限                                      | `number` |
| `share`   | 占比，0 到 1，和圆环画出来的一致          | `number` |
| `percent` | 整数百分比，0 到 100，和 `showLabel` 一致 | `number` |
