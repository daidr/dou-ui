# InputOTP 验证码输入

按位输入验证码，每位一个格子。底层是原生输入框，短信验证码自动填充、粘贴和读屏都与普通输入框一致。

## 基础用法

默认 6 位数字，只接受数字，其他字符直接忽略；填满时触发 `complete`。粘贴一整段（比如“482 913”）会自动去掉空格填进去。

<DocDemo src="input-otp/basic" column />

## 分组与遮盖

`separator` 在第几位之后留一道间隔（可以传数组），默认画一条短横线，也可以用 `separator` 插槽换成别的；`mask` 把字符显示成圆点。

<DocDemo src="input-otp/group-overlay" column />

## 字母与数字

`type="alphanumeric"` 接受字母和数字，`type="text"` 接受任意非空白字符。

<DocDemo src="input-otp/charset" column />

## 尺寸与状态

<DocDemo src="input-otp/size-state" column />

## API

### InputOtp Props

| 名称                    | 说明                          | 类型                                    | 默认值      |
| ----------------------- | ----------------------------- | --------------------------------------- | ----------- |
| `modelValue`（v-model） | 验证码                        | `string`                                | `''`        |
| `length`                | 位数                          | `number`                                | `6`         |
| `type`                  | 每一位接受的字符              | `'numeric' \| 'alphanumeric' \| 'text'` | `'numeric'` |
| `mask`                  | 显示为圆点                    | `boolean`                               | `false`     |
| `separator`             | 在这些位之后留间隔（从 1 数） | `number \| number[]`                    | —           |
| `size`                  | 尺寸                          | `'sm' \| 'md' \| 'lg'`                  | `'md'`      |
| `disabled`              | 禁用                          | `boolean`                               | `false`     |
| `invalid`               | 标记为无效                    | `boolean`                               | `false`     |

其余属性（`name`、`aria-label`、`autofocus` 等）会传给内部的原生输入框。

### InputOtp Events

| 名称       | 说明         | 参数              |
| ---------- | ------------ | ----------------- |
| `complete` | 每一位都填满 | `(value: string)` |

### InputOtp Slots

| 名称        | 说明                           |
| ----------- | ------------------------------ |
| `separator` | 间隔里的内容，参数 `{ after }` |

### 键盘与读屏

- 整个验证码是一个原生输入框，带 `autocomplete="one-time-code"`，手机上能直接填入短信里的验证码；数字模式弹出数字键盘。
- 光标始终在末尾：输入填下一格，<DouKbd>Backspace</DouKbd> 删最后一位。
- 没有其他标签时，输入框的读屏标签是“验证码”；在 [Form](./form) 里使用表单项的标签。
