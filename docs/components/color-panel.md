# ColorPanel 取色面板

直接放在页面里的取色面板，用于设置页、主题编辑这类需要一直显示取色器的地方。[ColorPicker](./color-picker) 弹出的也是这个面板。

## 基础用法

`v-model` 绑定色值。面板默认带描边和背景，`bordered` 设为 `false` 时只保留内容，方便放进卡片或表单里。

<DocDemo src="color-panel/basic" />

## 面板与格式

`format`、`panel`、`gamut`、`showAlpha`、`presets` 与 ColorPicker 相同，详见 [ColorPicker](./color-picker#色值格式)。`showInput` 设为 `false` 时不显示底部的格式菜单和输入框。

<DocDemo src="color-panel/options" />

## 事件

拖动时会持续触发 `update:modelValue`；拖动结束、按键调整、输入色值或点击预设色后触发一次 `change`，适合在这时保存。

## API

### Props

| 名称         | 说明                                 | 类型                                 | 默认值     |
| ------------ | ------------------------------------ | ------------------------------------ | ---------- |
| `modelValue` | 色值，任意支持的格式，配合 `v-model` | `string \| null`                     | —          |
| `format`     | 写回 `v-model` 的格式                | `ColorFormat`                        | `'hex'`    |
| `panel`      | 取色面板，数组时可以切换             | `ColorPanelMode \| ColorPanelMode[]` | `'square'` |
| `gamut`      | 超出 sRGB 的颜色如何处理             | `'srgb' \| 'none'`                   | `'srgb'`   |
| `showAlpha`  | 可以调透明度                         | `boolean`                            | `false`    |
| `presets`    | 预设色，任意支持的格式               | `string[]`                           | `[]`       |
| `showInput`  | 显示格式菜单和输入框                 | `boolean`                            | `true`     |
| `bordered`   | 显示描边和背景                       | `boolean`                            | `true`     |
| `disabled`   | 禁用                                 | `boolean`                            | `false`    |

### Events

| 名称                | 说明                     | 参数                      |
| ------------------- | ------------------------ | ------------------------- |
| `update:modelValue` | 颜色变化，拖动时持续触发 | `(value: string \| null)` |
| `change`            | 一次调整结束             | `(value: string \| null)` |

### Exposes

| 名称    | 说明           |
| ------- | -------------- |
| `focus` | 聚焦第一个滑块 |

### 类型

```ts
type ColorPanelMode = 'square' | 'wheel' | ColorSpace
```
