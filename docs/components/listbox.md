# Listbox 列表选择

直接展示在页面中的选项列表，适合选项不多、希望一次看到全部选项的场景，例如设置页、侧栏筛选。

## 基础用法

选项与 Select 的写法相同：字符串、数字，或带 `value`、`label` 的对象。对象还可以带 `description` 显示第二行。

<DocDemo src="listbox/basic" />

## 多选与图标

`multiple` 时点一下切换一项，`v-model` 是数组。选项的 `icon` 放在文字前面。

<DocDemo src="listbox/multiple-icon" />

## 分组、搜索与限高

分组的写法也与 Select 相同。`filterable` 在列表上方放一个搜索框，同时匹配标签与说明；`max-height` 限制列表高度，超出后列表内部滚动。设了 `max-height` 且选项超过 100 个时，列表只渲染看得见的选项；带说明的选项会自动按更高的行计算，自定义了高度不一的选项时传 `:virtual="false"`。

<DocDemo src="listbox/group-search" />

## API

### Props

| 名称                    | 说明                                                                 | 类型                                                          | 默认值  |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- | ------- |
| `modelValue`（v-model） | 选中的值，多选时为数组                                               | `ListboxValue \| ListboxValue[] \| null`                      | —       |
| `options`               | 选项，字符串与数字同时作值与标签；可以分组                           | `(ListboxOption \| ListboxOptionGroup \| string \| number)[]` | —       |
| `multiple`              | 多选，点一下切换一项                                                 | `boolean`                                                     | `false` |
| `filterable`            | 列表上方显示搜索框                                                   | `boolean`                                                     | `false` |
| `size`                  | 尺寸                                                                 | `'sm' \| 'md' \| 'lg'`                                        | `'md'`  |
| `disabled`              | 禁用                                                                 | `boolean`                                                     | `false` |
| `maxHeight`             | 列表最大高度，超出后滚动；数字为 px                                  | `number \| string`                                            | —       |
| `virtual`               | 设了 `maxHeight` 时只渲染看得见的选项；不传时超过 100 个选项自动开启 | `boolean`                                                     | —       |
| `ariaLabel`             | 没有可见标签时给读屏的名字                                           | `string`                                                      | —       |

`ListboxOption` 为 `{ value, label?, description?, icon?, disabled? }`，`ListboxOptionGroup` 为 `{ label, options, disabled? }`。

### Events

| 名称                | 说明               | 参数                                              |
| ------------------- | ------------------ | ------------------------------------------------- |
| `update:modelValue` | 值变化             | `(value: ListboxValue \| ListboxValue[] \| null)` |
| `change`            | 用户选中或取消选项 | 同上                                              |

### Slots

| 名称     | 说明                                        |
| -------- | ------------------------------------------- |
| `option` | 每个选项的内容，参数 `{ option, selected }` |
| `empty`  | 没有选项或搜索无结果时显示                  |

### Methods

| 名称    | 说明                         |
| ------- | ---------------------------- |
| `focus` | 聚焦列表；可搜索时聚焦搜索框 |

### 键盘与读屏

- 列表是 `role="listbox"`，多选时带 `aria-multiselectable`；选项是 `role="option"`，以 `aria-selected` 标明是否选中，当前项用 `aria-activedescendant` 指出。
- `↑` `↓` 移动并跳过禁用项，`Home` `End` 到首尾，`Enter` 或 `Space` 选中（多选时切换）。
- 列表聚焦时直接输入字母会跳到以它开头的选项，重复按同一个字母依次经过。
- 可搜索时焦点留在搜索框里，方向键照样移动列表中的当前项，`Enter` 选中。
- 在 [FormItem](./form) 里由表单项的标签命名。
