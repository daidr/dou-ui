# Button 按钮

触发一个操作。

## 变体与语气

`variant` 设置按钮的样式，`tone` 表示操作的语义，两者可以任意组合。

<DocDemo src="button/variant" />

<DocDemo src="button/variant-2" />

## 尺寸

`sm`、`md`、`lg` 与输入框、选择器等控件的同名尺寸等高，放在一行里能对齐。

<DocDemo src="button/size" />

### 紧凑的次要操作

`xs` 高 24px，只用于密集的行和工具栏里的次要操作，比如列表行尾的「回复」「删除」、代码块角落的「复制」。它不该用于主操作：主操作需要足够醒目，也需要足够大的点击区域。

在触屏上，`xs` 按钮的可点击区域会向四周扩展到约 40px，外观不变。扩展区域重叠时，重叠部分归后面的按钮，所以相邻的 `xs` 按钮之间至少留 8px，这样扩展区域只会落在间隙里，不会盖住旁边按钮本身。

`xs` 是按钮独有的尺寸，表单和 FieldGroup 设置的 `size` 不会让按钮变成 `xs`，需要在按钮上直接写 `size="xs"`。

<DocDemo src="button/size-xs" />

## 禁用与加载

加载中的按钮会显示指示器并阻止点击，但**仍然可以获得焦点**，读屏软件会读到 `aria-busy`。
禁用的按钮使用原生 `disabled`。

<DocDemo src="button/disabled-loading" />

## 图标

用 `leading` / `trailing` 插槽放置图标。加载时 `leading` 会被指示器替代。图标所在一侧的内边距比文字一侧小，让按钮两边看起来一样宽；只有图标的按钮不受影响。

<DocDemo src="button/icon" />

<DocDemo src="button/icon-2" />

只放一个图标时，可以直接写在默认插槽里，按钮会变成正方形，图标居中。这种按钮没有可见文字，记得用 `aria-label` 说明它的作用。

<DocDemo src="button/icon-only" />

## API

### Props

| 名称         | 说明                          | 类型                                                           | 默认值      |
| ------------ | ----------------------------- | -------------------------------------------------------------- | ----------- |
| `variant`    | 视觉权重                      | `'solid' \| 'soft' \| 'outline' \| 'ghost'`                    | `'solid'`   |
| `tone`       | 操作的语义                    | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `size`       | 尺寸，`xs` 只用于次要操作     | `'xs' \| 'sm' \| 'md' \| 'lg'`                                 | `'md'`      |
| `disabled`   | 禁用                          | `boolean`                                                      | `false`     |
| `loading`    | 加载中                        | `boolean`                                                      | `false`     |
| `block`      | 撑满容器宽度                  | `boolean`                                                      | `false`     |
| `nativeType` | 原生 `type`，默认不会提交表单 | `'button' \| 'submit' \| 'reset'`                              | `'button'`  |

### Events

| 名称    | 说明                             | 参数                  |
| ------- | -------------------------------- | --------------------- |
| `click` | 点击时触发，禁用或加载中不会触发 | `(event: MouseEvent)` |

### Slots

| 名称       | 说明                             |
| ---------- | -------------------------------- |
| `default`  | 按钮文字；只放图标时按钮为正方形 |
| `leading`  | 文字前的内容                     |
| `trailing` | 文字后的内容                     |

### CSS 变量

组件内部变量，可在局部覆盖：

| 变量                        | 说明                     |
| --------------------------- | ------------------------ |
| `--dou-button-tone`         | 基础色                   |
| `--dou-button-tone-on`      | 实心背景上的前景色       |
| `--dou-button-height`       | 高度                     |
| `--dou-button-padding-x`    | 水平内边距               |
| `--dou-button-padding-icon` | 图标所在一侧的水平内边距 |
| `--dou-button-radius`       | 圆角                     |
