# Checkbox 多选框

在一组选项中选择任意多个，或单独表示“是 / 否”。

原生 `<input type="checkbox">` 始终保留在原位，点击、键盘与表单行为都由浏览器提供。选中后的样式与实心按钮一致。

## 基础用法

<DocDemo src="checkbox/basic" />

## 自定义值

单独使用时，`v-model` 默认是 `true` / `false`。接口要的是别的值时，用 `checkedValue` 和 `uncheckedValue` 指定选中与未选中时的值。

<DocDemo src="checkbox/values" />

## 多选组

在 `DouCheckboxGroup` 中，`v-model` 是被选中选项的 `value` 数组。

<DocDemo src="checkbox/group" column />

`indeterminate` 只影响外观（并同步到原生元素，读屏软件会读作“部分选中”），点击仍然切换 `modelValue`。

## 尺寸与禁用

<DocDemo src="checkbox/size-disabled" />

组上的 `size`、`disabled`、`name` 会传给组内的每一项；单项上的设置优先。

## 单行省略

文字按大写字母的高度居中（见[视觉语言](/guide/visual-language#垂直居中)），文字盒比字形矮。在标签里自己做单行省略时，用 `overflow-x: clip` 只横向裁切；用 `overflow: hidden` 会切掉中文的上下部分。

```vue
<DouCheckbox v-model="checked">
  <span class="option-text">{{ text }}</span>
</DouCheckbox>

<style>
.option-text {
  display: block;
  overflow-x: clip; /* 不要用 overflow: hidden */
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

## API

### Checkbox Props

| 名称             | 说明                                                                               | 类型                   | 默认值  |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------- | ------- |
| `modelValue`     | 当前值，配合 `v-model`；选中时为 `checkedValue`，否则为 `uncheckedValue`；组内忽略 | `T`（默认 `boolean`）  | —       |
| `checkedValue`   | 选中时的值；组内忽略                                                               | `T`                    | `true`  |
| `uncheckedValue` | 未选中时的值；组内忽略                                                             | `T`                    | `false` |
| `value`          | 在组中代表的值                                                                     | `string \| number`     | —       |
| `indeterminate`  | 部分选中的外观                                                                     | `boolean`              | `false` |
| `disabled`       | 禁用                                                                               | `boolean`              | `false` |
| `readonly`       | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读            | `boolean`              | `false` |
| `invalid`        | 标记为校验失败，边框显示危险色；在 FormItem 中校验失败时自动带上                   | `boolean`              | `false` |
| `size`           | 尺寸，默认继承组                                                                   | `'sm' \| 'md' \| 'lg'` | `'md'`  |
| `name`           | 原生 `name`，默认继承组                                                            | `string`               | —       |
| `ariaLabel`      | 没有可见标签时的读屏名称，如表格里选择一行的框                                     | `string`               | —       |

### CheckboxGroup Props

| 名称         | 说明                                                                    | 类型                         | 默认值         |
| ------------ | ----------------------------------------------------------------------- | ---------------------------- | -------------- |
| `modelValue` | 选中项的值，配合 `v-model`                                              | `(string \| number)[]`       | `[]`           |
| `disabled`   | 禁用全部                                                                | `boolean`                    | `false`        |
| `readonly`   | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读 | `boolean`                    | `false`        |
| `invalid`    | 标记为校验失败，边框显示危险色；在 FormItem 中校验失败时自动带上        | `boolean`                    | `false`        |
| `size`       | 尺寸                                                                    | `'sm' \| 'md' \| 'lg'`       | —              |
| `direction`  | 排列方向                                                                | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `name`       | 统一的原生 `name`                                                       | `string`                     | —              |

### Events

| 组件               | 名称                | 参数                            |
| ------------------ | ------------------- | ------------------------------- |
| `DouCheckbox`      | `update:modelValue` | `(value: T)`                    |
| `DouCheckboxGroup` | `update:modelValue` | `(value: (string \| number)[])` |

### CSS 变量

| 变量                     | 说明             |
| ------------------------ | ---------------- |
| `--dou-checkbox-tone`    | 选中时的底色     |
| `--dou-checkbox-tone-on` | 选中时勾号的颜色 |
| `--dou-checkbox-size`    | 方框边长         |
