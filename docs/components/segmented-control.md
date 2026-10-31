# SegmentedControl 分段控制器

在几个互斥的选项中选择一个，适合切换视图、时间粒度这类立即生效的选择。

## 基础用法

<DocDemo src="segmented-control/basic" />

选项可以直接写成字符串或数字，此时它既是值也是标签：

<DocDemo src="segmented-control/basic-2" />

## 撑满宽度

`block` 让控件撑满父元素，各选项平分宽度。

<DocDemo src="segmented-control/block" column style="max-width: 420px" />

## 自定义选项

`option` 插槽替换每个选项的内容，例如加上图标。插槽参数为 `{ option, checked }`。

<DocDemo src="segmented-control/custom-option" />

## 尺寸与禁用

<DocDemo src="segmented-control/size-disabled" column />

## 键盘与读屏

每个选项都是一个原生单选框，共享同一个 `name`：`Tab` 进入时聚焦当前选项，方向键在选项之间移动并立即选中，与单选框组完全一致。外层带有 `role="radiogroup"`；放在 [表单项](./form) 中时，由表单项的标签通过 `aria-labelledby` 命名。

## API

### Props

| 名称         | 说明                                                                    | 类型                                             | 默认值  |
| ------------ | ----------------------------------------------------------------------- | ------------------------------------------------ | ------- |
| `modelValue` | 选中值，配合 `v-model`                                                  | `string \| number \| boolean`                    | —       |
| `options`    | 选项；字符串或数字同时作为值和标签                                      | `(SegmentedControlOption \| string \| number)[]` | —       |
| `size`       | 尺寸，默认取表单或全局配置                                              | `'sm' \| 'md' \| 'lg'`                           | `'md'`  |
| `block`      | 撑满宽度，选项平分                                                      | `boolean`                                        | `false` |
| `disabled`   | 禁用全部                                                                | `boolean`                                        | `false` |
| `readonly`   | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读 | `boolean`                                        | `false` |
| `invalid`    | 标记为校验失败，边框显示危险色；在 FormItem 中校验失败时自动带上        | `boolean`                                        | `false` |
| `name`       | 原生 `name`，不传时自动生成                                             | `string`                                         | —       |

`SegmentedControlOption` 为 `{ value: string | number | boolean; label?: string; disabled?: boolean }`。

### Events

| 名称                | 说明             | 参数                                   |
| ------------------- | ---------------- | -------------------------------------- |
| `update:modelValue` | 值变化           | `(value: string \| number \| boolean)` |
| `change`            | 用户选了另一个项 | `(value: string \| number \| boolean)` |

### Slots

| 名称     | 说明                                   |
| -------- | -------------------------------------- |
| `option` | 选项内容，参数为 `{ option, checked }` |

### CSS 变量

| 变量                                   | 说明               |
| -------------------------------------- | ------------------ |
| `--dou-segmented-control-height`       | 高度               |
| `--dou-segmented-control-padding-x`    | 选项水平内边距     |
| `--dou-segmented-control-inset`        | 轨道与选中块的间距 |
| `--dou-segmented-control-bg`           | 轨道底色           |
| `--dou-segmented-control-indicator-bg` | 选中块底色         |
