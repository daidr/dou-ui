# DatePicker 日期选择

输入或挑选一个日期、月份、年份，或一段日期范围。字段和输入框画法一致，前面一个安静的日历图标；日历是一格格平铺的数字：今天在数字下方有一道短短的墨线，选中的那天变成实心墨色的按键，和实心按钮同一套描边与阴影；范围内的日子共享一层极淡的底色，首尾相连。

<script setup>
import { ref } from 'vue'
const date = ref('2026-10-28')
const month = ref('2026-10')
const year = ref('2026')
const range = ref(['2026-10-12', '2026-10-24'])
const limited = ref(null)
const noWeekend = (date) => {
  const day = new Date(date).getUTCDay()
  return day === 0 || day === 6
}
const inline = ref('2026-10-28')
function lastDays(days) {
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [f(start), f(end)]
}
const shortcut = ref(null)
</script>

## 值的形式

值是不带时间和时区的字符串：日期是 `YYYY-MM-DD`，月份是 `YYYY-MM`，年份是 `YYYY`，范围是 `[开始, 结束]`。日期选择处理的是"哪一天"，而不是某个时刻，字符串可以直接比较大小、直接提交给后端，不会因为时区差一天。需要 `Date` 时自己转换。

## 基础用法

<div class="demo">
  <DouDatePicker v-model="date" style="width: 200px" />
  <DouText variant="tertiary" size="sm">{{ date }}</DouText>
</div>

```vue
<DouDatePicker v-model="date" />
```

点击字段打开日历，选中后关闭。也可以直接输入：`2026-10-28`、`2026/10/28`、`2026.10.28` 都能识别，按 `Enter` 或离开字段时生效；无效或不可选的输入会恢复成原来的值。日历底部的"今天"按钮选中今天（今天不可选时不显示）。

## 月份与年份

`type` 为 `month` 或 `year` 时，日历直接从月份或年份开始。

<div class="demo">
  <DouDatePicker v-model="month" type="month" style="width: 160px" />
  <DouDatePicker v-model="year" type="year" style="width: 140px" />
</div>

```vue
<DouDatePicker v-model="month" type="month" />
<DouDatePicker v-model="year" type="year" />
```

## 日期范围

`range` 用两个输入框表示开始和结束，日历并排显示两个月。第一次点击定下一端，移动时预览范围，第二次点击定下另一端，先后顺序不限。

<div class="demo">
  <DouDatePicker v-model="range" range style="width: 280px" />
  <DouText variant="tertiary" size="sm">{{ range?.join(' → ') }}</DouText>
</div>

```vue
<DouDatePicker v-model="range" range />
```

## 可选范围

`min` / `max` 限定最早和最晚（包含两端），`disabled-date` 排除单独的日子。不可选的日子是灰色的，并带一道删除线。

<div class="demo">
  <DouDatePicker v-model="limited" min="2026-10-01" max="2026-11-30" :disabled-date="noWeekend" placeholder="十月至十一月的工作日" style="width: 240px" clearable />
</div>

```vue
<DouDatePicker
  v-model="value"
  min="2026-10-01"
  max="2026-11-30"
  :disabled-date="isWeekend"
  clearable
/>
```

## 快捷选项

`footer` 插槽放在日历底部，参数 `pick(value)` 直接选中一个值并关闭。

<div class="demo">
  <DouDatePicker v-model="shortcut" range style="width: 280px">
    <template #footer="{ pick }">
      <DouButton variant="ghost" size="sm" @click="pick(lastDays(7))">最近 7 天</DouButton>
      <DouButton variant="ghost" size="sm" @click="pick(lastDays(30))">最近 30 天</DouButton>
    </template>
  </DouDatePicker>
</div>

```vue
<DouDatePicker v-model="value" range>
  <template #footer="{ pick }">
    <DouButton variant="ghost" size="sm" @click="pick(lastDays(7))">最近 7 天</DouButton>
  </template>
</DouDatePicker>
```

## 单独使用日历

`DouCalendar` 是弹出层里的日历本身，可以直接放在页面上，接受同样的 `type`、`range`、`min`、`max`、`disabled-date`。它不画外框，放在什么容器里就是什么样子。

<div class="demo">
  <DouCard padding="sm"><DouCalendar v-model="inline" /></DouCard>
</div>

```vue
<DouCalendar v-model="date" />
```

## 尺寸与状态

<div class="demo">
  <DouDatePicker v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" :model-value="date" style="width: 180px" />
  <DouDatePicker disabled :model-value="date" style="width: 180px" />
  <DouDatePicker invalid style="width: 180px" />
</div>

## 一周的第一天

默认按语言决定：英文从周日开始，其他语言从周一开始。`week-start` 可以指定 `0`（周日）或 `1`（周一）。星期与月份的名称来自浏览器的 `Intl`，跟随语言包的 `name`，不需要另外翻译。

## 键盘与读屏

输入框是 `role="combobox"`，`aria-haspopup="dialog"`，指向弹出的 `role="dialog"`。在输入框里按 `↓` 进入日历，`Esc` 关闭并回到输入框。

日历是 `role="grid"` 的表格，列头带完整的星期名称（`abbr`），每一天是一个按钮，读出完整日期（"2026年10月28日星期三"）；今天带 `aria-current="date"`，选中的格子 `aria-selected="true"`。只有当前日期在 `Tab` 顺序里：

| 按键                            | 行为                  |
| ------------------------------- | --------------------- |
| `←` `→`                         | 前一天 / 后一天       |
| `↑` `↓`                         | 上一周 / 下一周       |
| `Home` `End`                    | 本周第一天 / 最后一天 |
| `PageUp` `PageDown`             | 上个月 / 下个月       |
| `Shift` + `PageUp` / `PageDown` | 上一年 / 下一年       |
| `Enter` `Space`                 | 选中                  |

在月份和年份视图里，方向键按格移动，`PageUp` / `PageDown` 翻一年或十年。

## API

### DatePicker Props

| 名称               | 说明                             | 类型                                 | 默认值           |
| ------------------ | -------------------------------- | ------------------------------------ | ---------------- |
| `modelValue`       | 值，配合 `v-model`               | `string \| [string, string] \| null` | —                |
| `type`             | 选择日期、月份还是年份           | `'date' \| 'month' \| 'year'`        | `'date'`         |
| `range`            | 选择一段日期                     | `boolean`                            | `false`          |
| `min`              | 最早可选，包含                   | `string`                             | —                |
| `max`              | 最晚可选，包含                   | `string`                             | —                |
| `disabledDate`     | 排除某些日子                     | `(date: string) => boolean`          | —                |
| `weekStart`        | 一周的第一天                     | `0 \| 1`                             | 按语言           |
| `panels`           | 并排显示几个月                   | `1 \| 2`                             | 范围为 2，否则 1 |
| `placeholder`      | 占位文字                         | `string`                             | 语言包           |
| `startPlaceholder` | 范围开始的占位文字               | `string`                             | 语言包           |
| `endPlaceholder`   | 范围结束的占位文字               | `string`                             | 语言包           |
| `clearable`        | 显示清空按钮                     | `boolean`                            | `false`          |
| `size`             | 尺寸，默认取表单或全局配置       | `'sm' \| 'md' \| 'lg'`               | `'md'`           |
| `disabled`         | 禁用                             | `boolean`                            | `false`          |
| `invalid`          | 标记为无效                       | `boolean`                            | `false`          |
| `placement`        | 日历弹出的位置                   | `Placement`                          | `'bottom-start'` |
| `teleport`         | 日历渲染到哪里，`false` 留在原处 | `string \| HTMLElement \| false`     | `'body'`         |

### DatePicker Events

| 名称                | 说明                 | 参数                                          |
| ------------------- | -------------------- | --------------------------------------------- |
| `update:modelValue` | 值变化               | `(value: string \| [string, string] \| null)` |
| `change`            | 用户选中、输入或清空 | `(value: string \| [string, string] \| null)` |
| `select`            | 在日历里选中         | `(value: string \| [string, string])`         |

### DatePicker Slots

| 名称     | 说明                        |
| -------- | --------------------------- |
| `footer` | 日历底部，参数为 `{ pick }` |

### Calendar

`DouCalendar` 接受 DatePicker 中 `modelValue`、`type`、`range`、`min`、`max`、`disabledDate`、`weekStart`、`panels` 这几项，触发 `update:modelValue` 与 `select`。插槽 `cell` 替换日期格里的数字（参数 `{ date, day }`），`footer` 放在底部。暴露 `focus()` 和 `show(value)`（翻到某个值所在的月份）。
