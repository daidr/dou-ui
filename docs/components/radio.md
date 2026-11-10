# Radio 单选框

在一组互斥的选项中选择一个。

## 基础用法

把选项放进 `DouRadioGroup`，`v-model` 是被选中选项的 `value`。组会为选项生成共享的 `name`，因此方向键切换、表单提交等行为都由浏览器原生处理。

<DocDemo src="radio/basic" column />

## 垂直排列

<DocDemo src="radio/vertical" />

## 尺寸与禁用

<DocDemo src="radio/size-disabled" />

单个 `DouRadio` 也可以脱离组使用 `v-model`，此时需要自己给同一组选项设置相同的 `name`。

## 单行省略

文字按大写字母的高度居中（见[视觉语言](/guide/visual-language#垂直居中)），文字盒比字形矮。在标签里自己做单行省略时，用 `overflow-x: clip` 只横向裁切；用 `overflow: hidden` 会切掉中文的上下部分。单选框本身默认随文字变宽，还要限制它的宽度（如 `max-width: 100%`，在 flex 布局里也可以用 `min-width: 0`），省略号才会出现。

```vue
<DouRadio v-model="picked" :value="value" style="max-width: 100%">
  <span class="option-text">{{ text }}</span>
</DouRadio>

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

### Radio Props

| 名称         | 说明                                                                    | 类型                          | 默认值  |
| ------------ | ----------------------------------------------------------------------- | ----------------------------- | ------- |
| `value`      | 选项代表的值（必填）                                                    | `string \| number \| boolean` | —       |
| `modelValue` | 不在组中时的选中值，配合 `v-model`                                      | `string \| number \| boolean` | —       |
| `disabled`   | 禁用                                                                    | `boolean`                     | `false` |
| `readonly`   | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读 | `boolean`                     | `false` |
| `size`       | 尺寸，默认继承组                                                        | `'sm' \| 'md' \| 'lg'`        | `'md'`  |
| `name`       | 原生 `name`，组内使用组的名字                                           | `string`                      | —       |

### RadioGroup Props

| 名称         | 说明                                                                    | 类型                          | 默认值         |
| ------------ | ----------------------------------------------------------------------- | ----------------------------- | -------------- |
| `modelValue` | 选中值，配合 `v-model`                                                  | `string \| number \| boolean` | —              |
| `disabled`   | 禁用全部                                                                | `boolean`                     | `false`        |
| `readonly`   | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读 | `boolean`                     | `false`        |
| `invalid`    | 标记为校验失败，边框显示危险色；在 FormItem 中校验失败时自动带上        | `boolean`                     | `false`        |
| `size`       | 尺寸                                                                    | `'sm' \| 'md' \| 'lg'`        | —              |
| `direction`  | 排列方向                                                                | `'horizontal' \| 'vertical'`  | `'horizontal'` |
| `name`       | 原生 `name`，不传时自动生成                                             | `string`                      | —              |

### Events

| 组件            | 名称                | 参数                                   |
| --------------- | ------------------- | -------------------------------------- |
| `DouRadio`      | `update:modelValue` | `(value: string \| number \| boolean)` |
| `DouRadioGroup` | `update:modelValue` | `(value: string \| number \| boolean)` |

### CSS 变量

| 变量                  | 说明             |
| --------------------- | ---------------- |
| `--dou-radio-tone`    | 选中时的底色     |
| `--dou-radio-tone-on` | 选中时圆点的颜色 |
| `--dou-radio-size`    | 直径             |
