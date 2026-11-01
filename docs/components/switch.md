# Switch 开关

在开和关两种状态之间切换，切换后立即生效。

## 基础用法

<DocDemo src="switch/basic" />

开关渲染为 `role="switch"` 的原生按钮，`aria-checked` 反映状态，标签文字通过 `aria-labelledby` 关联；点击标签同样会切换。

## 尺寸

<DocDemo src="switch/size" />

## 加载与禁用

切换需要等待服务端确认时，用 `loading` 显示指示器并暂时忽略操作；与按钮一致，加载中的开关**仍可获得焦点**。

<DocDemo src="switch/loading-disabled" />

## 切换前确认

`beforeChange` 在切换之前调用，参数是即将切换到的值。返回 `false`，或返回的 Promise 结果为 `false`、被拒绝时，开关保持原样；Promise 等待期间开关显示加载指示器，并忽略再次点击。这样“保存成功才切换”不必自己管理 `loading`。

<DocDemo src="switch/before-change" />

## 自定义值

开关的值默认是 `true` / `false`。接口里是字符串或数字时，用 `checkedValue` 与 `uncheckedValue` 指定打开和关闭时的值，`v-model` 的类型随之推断。

<DocDemo src="switch/values" />

## 只读与校验失败

`readonly` 只展示状态、不能切换，开关仍可获得焦点，颜色也不会变灰；放在设置了 `readonly` 的 [Form](./form) 里时自动只读。`invalid` 把关闭状态的边框标成危险色，在 FormItem 中校验失败时会自动带上。

## API

### Props

| 名称             | 说明                                                 | 类型                                                       | 默认值  |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------------- | ------- |
| `modelValue`     | 当前值，配合 `v-model`                               | `T`（默认 `boolean`）                                      | —       |
| `checkedValue`   | 打开时的值                                           | `T`                                                        | `true`  |
| `uncheckedValue` | 关闭时的值                                           | `T`                                                        | `false` |
| `disabled`       | 禁用                                                 | `boolean`                                                  | `false` |
| `readonly`       | 只读，可聚焦但不能切换                               | `boolean`                                                  | `false` |
| `invalid`        | 标记为校验失败                                       | `boolean`                                                  | `false` |
| `loading`        | 加载中，忽略操作但可聚焦                             | `boolean`                                                  | `false` |
| `beforeChange`   | 切换前调用，返回 `false` 或被拒绝的 Promise 时不切换 | `(next: T) => boolean \| void \| Promise<boolean \| void>` | —       |
| `size`           | 尺寸                                                 | `'sm' \| 'md' \| 'lg'`                                     | `'md'`  |
| `ariaLabel`      | 没有可见标签时给读屏的名字                           | `string`                                                   | —       |

### Events

| 名称                | 说明     | 参数         |
| ------------------- | -------- | ------------ |
| `update:modelValue` | 状态切换 | `(value: T)` |

### Slots

| 名称      | 说明                     |
| --------- | ------------------------ |
| `default` | 标签文字，点击同样会切换 |

### CSS 变量

| 变量                   | 说明           |
| ---------------------- | -------------- |
| `--dou-switch-tone`    | 打开时轨道颜色 |
| `--dou-switch-tone-on` | 打开时滑块颜色 |
| `--dou-switch-width`   | 轨道宽度       |
| `--dou-switch-height`  | 轨道高度       |
