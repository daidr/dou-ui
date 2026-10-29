# CheckTag 可选标签

可以点击选中的标签，用于筛选栏、兴趣选择这类排成一行的选项。

## 基础用法

用 `v-model:checked` 绑定是否选中。未选中时是描边样式，选中后用 `tone` 的颜色填充。

<DocDemo src="check-tag/basic" />

## 标签组

`DouCheckTagGroup` 用 `options` 生成一组标签，`v-model` 绑定选中的值。默认只能选一个，再次点击已选中的标签不会取消，设置 `clearable` 后可以取消；`multiple` 时值是数组。组上的 `tone`、`size`、`round` 会传给每个标签。

<DocDemo src="check-tag/group" column />

## 自定义标签

默认插槽可以直接放 `DouCheckTag`，用 `value` 对应组的值；`leading` 插槽放在文字前，比如图标。

<DocDemo src="check-tag/slot" />

## 读屏

每个标签是原生按钮，用 `aria-pressed` 表示是否选中；标签组带 `role="group"`，放在 FormItem 里时以表单项的标签命名。

## API

### CheckTag Props

| 名称       | 说明                                             | 类型                                                           | 默认值      |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------- | ----------- |
| `checked`  | 是否选中，配合 `v-model:checked`；在组里由组决定 | `boolean`                                                      | `false`     |
| `value`    | 在组里代表的值                                   | `string \| number`                                             | —           |
| `tone`     | 选中时的颜色                                     | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `size`     | 尺寸                                             | `'sm' \| 'md' \| 'lg'`                                         | `'md'`      |
| `round`    | 两端为半圆                                       | `boolean`                                                      | `false`     |
| `disabled` | 禁用                                             | `boolean`                                                      | `false`     |

### CheckTag Events

| 名称             | 说明               | 参数                 |
| ---------------- | ------------------ | -------------------- |
| `update:checked` | 点击后，不在组里时 | `(checked: boolean)` |
| `change`         | 同上               | `(checked: boolean)` |

### CheckTagGroup Props

| 名称         | 说明                                    | 类型                                       | 默认值  |
| ------------ | --------------------------------------- | ------------------------------------------ | ------- |
| `modelValue` | 选中的值，`multiple` 时为数组           | `CheckTagValue \| CheckTagValue[] \| null` | —       |
| `options`    | 标签，值或 `{ value, label, disabled }` | `(CheckTagValue \| CheckTagOption)[]`      | —       |
| `multiple`   | 可以多选                                | `boolean`                                  | `false` |
| `clearable`  | 单选时再次点击可以取消                  | `boolean`                                  | `false` |
| `tone`       | 每个标签的颜色                          | `Tone`                                     | —       |
| `size`       | 每个标签的尺寸，默认取表单或全局配置    | `'sm' \| 'md' \| 'lg'`                     | `'md'`  |
| `round`      | 每个标签两端为半圆                      | `boolean`                                  | `false` |
| `disabled`   | 禁用整组                                | `boolean`                                  | `false` |

### CheckTagGroup Events

| 名称                | 说明     | 参数                                                |
| ------------------- | -------- | --------------------------------------------------- |
| `update:modelValue` | 选择变化 | `(value: CheckTagValue \| CheckTagValue[] \| null)` |
| `change`            | 同上     | 同上                                                |

### Slots

| 名称      | 说明                                                                    |
| --------- | ----------------------------------------------------------------------- |
| `default` | CheckTag 的文字；CheckTagGroup 里放 CheckTag                            |
| `leading` | CheckTag 文字前的内容                                                   |
| `label`   | CheckTagGroup 中由 `options` 生成的标签文字，参数 `{ option, checked }` |
