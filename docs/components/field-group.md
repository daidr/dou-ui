# FieldGroup 组合

将多个按钮或输入控件组合为一个整体，相邻的边框会合并，连接处的圆角变为直角。

## 按钮组

<DocDemo src="field-group/group" />

只是在几个选项里选一个时，用 [SegmentedControl](./segmented-control) 更合适；按钮组适合几个并列的动作。

## 输入组合

输入框、选择器旁边接按钮、下拉或一段固定文字。`DouFieldGroupText` 放不可编辑的文字或图标，比如协议前缀、单位。`block` 让组合占满一整行，输入类控件会分到剩下的宽度。

<DocDemo src="field-group/composition" column />

按钮与文字保持自身宽度，其余控件平分剩下的空间。要让某个控件固定宽度，给它 `style="flex: 0 0 96px"`。

## 尺寸

`size` 会传给里面没有自己设置尺寸的控件，包括 `DouFieldGroupText`，一整组一起变。

<DocDemo src="field-group/size" column />

## 纵向

`orientation="vertical"` 让控件上下排列，边框在上下方向合并。

<DocDemo src="field-group/vertical" />

## API

### FieldGroup Props

| 名称          | 说明                                   | 类型                         | 默认值         |
| ------------- | -------------------------------------- | ---------------------------- | -------------- |
| `orientation` | 横向或纵向排列                         | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `size`        | 里面没有自己设置尺寸的控件都用这个尺寸 | `'sm' \| 'md' \| 'lg'`       | —              |
| `block`       | 占满容器宽度                           | `boolean`                    | `false`        |

### Slots

| 名称      | 说明                                                 |
| --------- | ---------------------------------------------------- |
| `default` | 按钮、输入框、选择器等控件，以及 `DouFieldGroupText` |

`DouFieldGroupText` 没有属性，默认插槽放文字或图标。

### 键盘与读屏

- 组合渲染为 `role="group"`，纵向时带 `aria-orientation="vertical"`；需要名字时给它 `aria-label`。
- 里面每个控件保持自己的键盘行为，Tab 依次经过。
