# Slider 滑块

拖动滑块，在一段范围内选择一个值或一个区间。

## 基础用法

<DocDemo src="slider/basic" column style="max-width: 420px" />

不在 [表单项](./form) 里时，用 `aria-label` 或 `aria-labelledby` 为滑块命名，它们会落在滑块本身（`role="slider"`）上。

## 范围选择

`range` 显示两枚滑块，`v-model` 绑定 `[起点, 终点]`。两枚滑块不会越过彼此；重叠时朝哪边拖就由哪一枚接手。

<DocDemo src="slider/range" column style="max-width: 420px" />

两枚滑块的读屏标签（“起始值” / “结束值”）来自 [全局配置](./config-provider) 的语言包。

## 步长与刻度

`step` 决定可取的值；`marks` 在滑轨下方标注刻度，键为刻度所在的值。范围以内的刻度会加深。`format` 决定读屏软件念出的文字，也用于数值气泡。

<DocDemo src="slider/step-marks" column style="max-width: 420px" />

## 数值气泡

`tooltip` 在滑块上方显示当前值：拖动、悬停或用键盘聚焦时出现。设为 `'always'` 则一直显示。气泡里的文字与读屏一样来自 `format`。

<DocDemo src="slider/tooltip" />

## 竖向

`vertical` 让轨道从下往上排列，`height` 设置长度（默认 200px）。范围选择和刻度同样可用，刻度标签显示在轨道右侧。

<DocDemo src="slider/vertical" />

## 带输入框

`showInput` 在右侧放一个 [InputNumber](./input-number)，两边同步：拖动时输入框跟着变，输入确认后滑块跳过去，超出范围或不在步长上的值会被修正。只用于单值滑块。

<DocDemo src="slider/with-input" column />

## 键盘与指针

| 操作                  | 行为                           |
| --------------------- | ------------------------------ |
| `→` / `↑`             | 增加一个步长                   |
| `←` / `↓`             | 减少一个步长                   |
| `PageUp` / `PageDown` | 增加 / 减少约十分之一的范围    |
| `Home` / `End`        | 跳到最小 / 最大值              |
| 按下滑轨              | 最近的滑块跳到该处，并跟随拖动 |
| 按下滑块              | 抓住滑块，从原位置开始拖动     |

拖动过程中持续更新 `v-model`，松开时触发一次 `change`；键盘每次移动都会触发 `change`。放在表单项中时，`change` 会触发校验。

## 尺寸与状态

<DocDemo src="slider/size-state" column style="max-width: 420px" />

## API

### Props

| 名称         | 说明                                                                    | 类型                         | 默认值  |
| ------------ | ----------------------------------------------------------------------- | ---------------------------- | ------- |
| `modelValue` | 绑定值，配合 `v-model`；范围模式下为一对                                | `number \| [number, number]` | —       |
| `range`      | 选择一个区间                                                            | `boolean`                    | `false` |
| `min`        | 最小值                                                                  | `number`                     | `0`     |
| `max`        | 最大值                                                                  | `number`                     | `100`   |
| `step`       | 步长，可取的值为 `min` 加步长的整数倍                                   | `number`                     | `1`     |
| `marks`      | 刻度标签，键为刻度所在的值                                              | `Record<number, string>`     | —       |
| `format`     | 读屏软件念出的文字                                                      | `(value: number) => string`  | —       |
| `vertical`   | 竖向，从下往上                                                          | `boolean`                    | `false` |
| `height`     | 竖向时的长度，数字为 px                                                 | `number \| string`           | `200px` |
| `showInput`  | 旁边放一个同步的数字输入框（单值）                                      | `boolean`                    | `false` |
| `tooltip`    | 在滑块上方显示数值，`'always'` 一直显示                                 | `boolean \| 'always'`        | `false` |
| `size`       | 尺寸，默认取表单或全局配置                                              | `'sm' \| 'md' \| 'lg'`       | `'md'`  |
| `disabled`   | 禁用                                                                    | `boolean`                    | `false` |
| `readonly`   | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读 | `boolean`                    | `false` |
| `invalid`    | 标记为无效，填充改为危险语气                                            | `boolean`                    | `false` |

### Events

| 名称                | 说明                               | 参数                                  |
| ------------------- | ---------------------------------- | ------------------------------------- |
| `update:modelValue` | 值变化，拖动过程中持续触发         | `(value: number \| [number, number])` |
| `change`            | 提交了新的值：松开、键盘或点击滑轨 | `(value: number \| [number, number])` |

### Exposes

| 名称    | 说明           | 类型         |
| ------- | -------------- | ------------ |
| `focus` | 聚焦第一枚滑块 | `() => void` |
| `blur`  | 让滑块失去焦点 | `() => void` |

### CSS 变量

| 变量                        | 说明         |
| --------------------------- | ------------ |
| `--dou-slider-tone`         | 填充颜色     |
| `--dou-slider-rail-size`    | 滑轨粗细     |
| `--dou-slider-thumb-size`   | 滑块直径     |
| `--dou-slider-rail-bg`      | 滑轨底色     |
| `--dou-slider-thumb-bg`     | 滑块底色     |
| `--dou-slider-thumb-border` | 滑块描边颜色 |
| `--dou-slider-ring`         | 聚焦光晕颜色 |
