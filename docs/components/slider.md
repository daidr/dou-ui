# Slider 滑块

在一段连续的范围里拖选一个值或一个区间。滑轨是凹进页面的一道槽，与关闭状态的 [开关](./switch) 同质；值以内的部分填满墨色。滑块是一枚小小的凸起表面：细描边加静止阴影，与 outline 按钮相同。整个滑块与同尺寸的控件等高，放进表单行里能与输入框对齐。

<script setup>
import { ref } from 'vue'
const volume = ref(40)
const hours = ref([9, 18])
const temperature = ref(24)
const quality = ref(75)
</script>

## 基础用法

<div class="demo demo--column" style="max-width: 420px">
  <DouSlider v-model="volume" aria-label="音量" />
  <DouText variant="tertiary" size="sm">当前值：{{ volume }}</DouText>
</div>

```vue
<DouSlider v-model="volume" aria-label="音量" />
```

不在 [表单项](./form) 里时，用 `aria-label` 或 `aria-labelledby` 为滑块命名，它们会落在滑块本身（`role="slider"`）上。

## 范围选择

`range` 显示两枚滑块，`v-model` 绑定 `[起点, 终点]`。两枚滑块不会越过彼此；重叠时朝哪边拖就由哪一枚接手。

<div class="demo demo--column" style="max-width: 420px">
  <DouSlider v-model="hours" range :max="24" />
  <DouText variant="tertiary" size="sm">{{ hours[0] }}:00 – {{ hours[1] }}:00</DouText>
</div>

```vue
<DouSlider v-model="hours" range :max="24" />
```

两枚滑块的读屏标签（"起始值" / "结束值"）来自 [全局配置](./config-provider) 的语言包。

## 步长与刻度

`step` 决定可取的值；`marks` 在滑轨下方标注刻度，键为刻度所在的值。范围以内的刻度会加深。`formatValue` 决定读屏软件念出的文字。

<div class="demo demo--column" style="max-width: 420px">
  <DouSlider
    v-model="temperature"
    :min="16"
    :max="32"
    :step="2"
    :marks="{ 16: '16°C', 24: '24°C', 32: '32°C' }"
    :format-value="(v) => `${v} 摄氏度`"
    aria-label="温度"
  />
</div>

```vue
<DouSlider
  v-model="temperature"
  :min="16"
  :max="32"
  :step="2"
  :marks="{ 16: '16°C', 24: '24°C', 32: '32°C' }"
  :format-value="(v) => `${v} 摄氏度`"
/>
```

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

<div class="demo demo--column" style="max-width: 420px">
  <DouSlider v-model="quality" size="sm" aria-label="sm" />
  <DouSlider v-model="quality" aria-label="md" />
  <DouSlider v-model="quality" size="lg" aria-label="lg" />
  <DouSlider :model-value="60" invalid aria-label="无效" />
  <DouSlider :model-value="30" disabled aria-label="禁用" />
</div>

## API

### Props

| 名称          | 说明                                     | 类型                         | 默认值  |
| ------------- | ---------------------------------------- | ---------------------------- | ------- |
| `modelValue`  | 绑定值，配合 `v-model`；范围模式下为一对 | `number \| [number, number]` | —       |
| `range`       | 选择一个区间                             | `boolean`                    | `false` |
| `min`         | 最小值                                   | `number`                     | `0`     |
| `max`         | 最大值                                   | `number`                     | `100`   |
| `step`        | 步长，可取的值为 `min` 加步长的整数倍    | `number`                     | `1`     |
| `marks`       | 刻度标签，键为刻度所在的值               | `Record<number, string>`     | —       |
| `formatValue` | 读屏软件念出的文字                       | `(value: number) => string`  | —       |
| `size`        | 尺寸，默认取表单或全局配置               | `'sm' \| 'md' \| 'lg'`       | `'md'`  |
| `disabled`    | 禁用                                     | `boolean`                    | `false` |
| `invalid`     | 标记为无效，填充改为危险语气             | `boolean`                    | `false` |

### Events

| 名称                | 说明                               | 参数                                  |
| ------------------- | ---------------------------------- | ------------------------------------- |
| `update:modelValue` | 值变化，拖动过程中持续触发         | `(value: number \| [number, number])` |
| `change`            | 提交了新的值：松开、键盘或点击滑轨 | `(value: number \| [number, number])` |

### 实例方法

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
