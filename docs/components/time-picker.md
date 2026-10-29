# TimePicker 时间选择

用于选择或输入时间，支持时间范围。

<script setup>
import { ref } from 'vue'
const time = ref('09:30')
const seconds = ref('14:05:30')
const range = ref(['09:00', '18:00'])
const stepped = ref('10:00')
</script>

## 值的形式

值是 24 小时制的字符串：`HH:mm`，或 `format="HH:mm:ss"` 时带秒；范围是 `[开始, 结束]`。和日期一样不含时区，可以直接比较大小。

## 基础用法

<div class="demo">
  <DouTimePicker v-model="time" style="width: 140px" />
  <DouTimePicker v-model="seconds" format="HH:mm:ss" style="width: 160px" />
  <DouText variant="tertiary" size="sm">{{ time }} · {{ seconds }}</DouText>
</div>

```vue
<DouTimePicker v-model="time" />
<DouTimePicker v-model="time" format="HH:mm:ss" />
```

点击某一列的数字会立即改动值，不用再确认；"此刻"选中当前时间，"确定"关闭弹出层。也可以直接输入：`9`、`9:5`、`09：30` 都能识别，按 `Enter` 或离开字段时生效，无法识别的输入会恢复成原来的值。

## 时间范围

`range` 用两个输入框表示开始和结束，弹出层里左右各一组列。关闭时如果开始晚于结束，会自动交换。

<div class="demo">
  <DouTimePicker v-model="range" range clearable style="width: 240px" />
</div>

```vue
<DouTimePicker v-model="range" range />
```

## 步长

`hour-step`、`minute-step`、`second-step` 让列里只出现整倍数；输入的值会就近落到步长上。

<div class="demo">
  <DouTimePicker v-model="stepped" :minute-step="15" style="width: 140px" />
</div>

```vue
<DouTimePicker v-model="time" :minute-step="15" />
```

## 尺寸与状态

<div class="demo">
  <DouTimePicker v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" :model-value="time" style="width: 130px" />
  <DouTimePicker disabled :model-value="time" style="width: 130px" />
  <DouTimePicker invalid style="width: 130px" />
</div>

## 键盘与读屏

输入框是 `role="combobox"`，`aria-haspopup="dialog"`。在输入框里按 `↓` 进入第一列，`Esc` 关闭并回到输入框。每一列是一个 `role="listbox"`，名称是"时""分""秒"；选中的数字 `aria-selected="true"`。

| 按键         | 行为              |
| ------------ | ----------------- |
| `↑` `↓`      | 上一个 / 下一个值 |
| `←` `→`      | 切换到相邻的列    |
| `Home` `End` | 第一个 / 最后一个 |
| `Enter`      | 关闭并回到输入框  |

## API

### TimePicker Props

| 名称               | 说明                         | 类型                                 | 默认值           |
| ------------------ | ---------------------------- | ------------------------------------ | ---------------- |
| `modelValue`       | 值，配合 `v-model`           | `string \| [string, string] \| null` | —                |
| `format`           | 是否带秒                     | `'HH:mm' \| 'HH:mm:ss'`              | `'HH:mm'`        |
| `range`            | 选择一段时间                 | `boolean`                            | `false`          |
| `hourStep`         | 小时列的步长                 | `number`                             | `1`              |
| `minuteStep`       | 分钟列的步长                 | `number`                             | `1`              |
| `secondStep`       | 秒列的步长                   | `number`                             | `1`              |
| `placeholder`      | 占位文字                     | `string`                             | 语言包           |
| `startPlaceholder` | 范围开始的占位文字           | `string`                             | 语言包           |
| `endPlaceholder`   | 范围结束的占位文字           | `string`                             | 语言包           |
| `clearable`        | 显示清空按钮                 | `boolean`                            | `false`          |
| `size`             | 尺寸，默认取表单或全局配置   | `'sm' \| 'md' \| 'lg'`               | `'md'`           |
| `disabled`         | 禁用                         | `boolean`                            | `false`          |
| `invalid`          | 标记为无效                   | `boolean`                            | `false`          |
| `placement`        | 弹出的位置                   | `Placement`                          | `'bottom-start'` |
| `teleport`         | 渲染到哪里，`false` 留在原处 | `string \| HTMLElement \| false`     | `'body'`         |

### TimePicker Events

| 名称                | 说明                 | 参数                                          |
| ------------------- | -------------------- | --------------------------------------------- |
| `update:modelValue` | 值变化               | `(value: string \| [string, string] \| null)` |
| `change`            | 用户选中、输入或清空 | `(value: string \| [string, string] \| null)` |
