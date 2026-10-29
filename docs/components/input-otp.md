# InputOTP 验证码输入

一位一格的验证码输入。每一格画得和输入框一样，只有下一位要落进去的那一格带焦点边框与光晕，视线自然跟着输入走。底下是一个透明的原生输入框，所以短信验证码自动填充、粘贴、撤销和读屏都和普通输入框一样。

<script setup>
import { ref } from 'vue'
const code = ref('')
const done = ref('')
const pin = ref('')
const invite = ref('')
</script>

## 基础用法

默认 6 位数字，只接受数字，其他字符直接忽略；填满时触发 `complete`。粘贴一整段（比如"482 913"）会自动去掉空格填进去。

<div class="demo demo--column">
  <DouInputOtp v-model="code" @complete="(value) => (done = value)" />
  <DouText size="sm" variant="tertiary">已输入：{{ code || '—' }}　完成：{{ done || '—' }}</DouText>
</div>

```vue
<DouInputOtp v-model="code" @complete="verify" />
```

## 分组与遮盖

`separator` 在第几位之后留一道间隔（可以传数组），默认画一条短横线，也可以用 `separator` 插槽换成别的；`mask` 把字符显示成圆点。

<div class="demo demo--column">
  <DouInputOtp v-model="pin" :length="6" :separator="3" mask />
</div>

```vue
<DouInputOtp v-model="pin" :separator="3" mask />
```

## 字母与数字

`type="alphanumeric"` 接受字母和数字，`type="text"` 接受任意非空白字符。

<div class="demo demo--column">
  <DouInputOtp v-model="invite" type="alphanumeric" :length="8" :separator="4" size="sm" />
</div>

```vue
<DouInputOtp v-model="invite" type="alphanumeric" :length="8" :separator="4" size="sm" />
```

## 尺寸与状态

<div class="demo demo--column">
  <DouInputOtp :length="4" size="lg" model-value="20" />
  <DouInputOtp :length="4" invalid model-value="1234" />
  <DouInputOtp :length="4" disabled model-value="12" />
</div>

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
- 没有其他标签时，输入框的读屏标签是"验证码"；在 [Form](./form) 里使用表单项的标签。
