# Toggle 切换按钮

可以按下和弹起的按钮，表示某个设置是否开启，例如文字是否加粗。

## 基础用法

`v-model:pressed` 绑定是否按下，按下时 `aria-pressed` 为 `true`。默认插槽只放一个图标时按钮变为方形，这时需要用 `aria-label` 说明它的作用。`variant` 可选 `ghost`（默认）或 `outline`。

<DocDemo src="toggle/basic" />

## 切换按钮组

`DouToggleGroup` 管理一组带 `value` 的 `DouToggle`。`type="single"`（默认）时最多按下一个，再点一次已按下的按钮会弹起，值变为 `null`；`type="multiple"` 时可以同时按下多个，值为数组。组上的 `variant`、`size`、`disabled` 会传给组内的按钮。

<DocDemo src="toggle/group" />

只能在几个选项中选一个、并且必须选一个时，用 [SegmentedControl](./segmented-control) 更合适。

## 键盘与读屏

- 每个按钮都是原生 `<button>`，带 `aria-pressed`，`Space` 和 `Enter` 切换。
- 按钮组是 `role="group"`，只有一个按钮在 `Tab` 顺序里，用方向键在组内移动，`Home` / `End` 到第一个和最后一个。`orientation="vertical"` 时用上下方向键。
- 放在 [Toolbar](./toolbar) 里时，由工具栏统一处理方向键。

## API

### Toggle Props

| 名称       | 说明                                           | 类型                   | 默认值    |
| ---------- | ---------------------------------------------- | ---------------------- | --------- |
| `pressed`  | 是否按下，配合 `v-model:pressed`；在组内不使用 | `boolean`              | `false`   |
| `value`    | 在 `DouToggleGroup` 中代表的值                 | `string \| number`     | —         |
| `variant`  | 样式                                           | `'ghost' \| 'outline'` | `'ghost'` |
| `size`     | 尺寸                                           | `'sm' \| 'md' \| 'lg'` | `'md'`    |
| `disabled` | 禁用                                           | `boolean`              | `false`   |

### Toggle Slots

| 名称      | 说明                 |
| --------- | -------------------- |
| `default` | 文字，或单独一个图标 |
| `leading` | 文字前的图标         |

### ToggleGroup Props

| 名称          | 说明                                                        | 类型                                               | 默认值         |
| ------------- | ----------------------------------------------------------- | -------------------------------------------------- | -------------- |
| `modelValue`  | 按下的值，`single` 时为单个值或 `null`，`multiple` 时为数组 | `string \| number \| (string \| number)[] \| null` | —              |
| `type`        | 最多按下一个，还是可以按下多个                              | `'single' \| 'multiple'`                           | `'single'`     |
| `variant`     | 组内按钮的样式                                              | `'ghost' \| 'outline'`                             | —              |
| `size`        | 组内按钮的尺寸                                              | `'sm' \| 'md' \| 'lg'`                             | —              |
| `disabled`    | 禁用整组                                                    | `boolean`                                          | `false`        |
| `orientation` | 用哪组方向键移动焦点，纵向时按钮上下排列                    | `'horizontal' \| 'vertical'`                       | `'horizontal'` |

### ToggleGroup Events

| 名称                | 说明                 | 参数      |
| ------------------- | -------------------- | --------- |
| `update:modelValue` | 按下的值变化         | `(value)` |
| `change`            | 用户按下或弹起了按钮 | `(value)` |
