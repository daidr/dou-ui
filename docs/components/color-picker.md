# ColorPicker 颜色选择

挑选一个颜色。字段是一块色样加上色值；弹出层里先是取色面板，再往下是可以直接编辑的色值和预设色。

颜色写成什么文本、用什么方式去挑，是两件互不相干的事：`format` 决定 `v-model` 的格式，`panel` 决定面板的样子。比如可以用色轮挑色、存成 `oklch()`，也可以用 OKLCH 滑块挑色、存成十六进制。

<script setup>
import { ref } from 'vue'
const color = ref('#3f56b5')
const alpha = ref('#2e7d5bcc')
const preset = ref('#a8572d')
const presets = ['#1f2328', '#3f56b5', '#2e7d5b', '#a8572d', '#b23a48', '#7a4fb5', '#5c6670', '#c99a2e']
const empty = ref(null)
const formatted = ref('oklch(0.55 0.15 255)')
const formats = ['hex', 'rgb', 'hsl', 'hsv', 'hwb', 'lab', 'lch', 'oklab', 'oklch']
const fmt = ref('oklch')
const wheel = ref('#3f56b5')
const sliders = ref('oklch(0.62 0.14 160)')
const multi = ref('#a8572d')
const wide = ref('oklch(0.7 0.3 150)')
</script>

## 基础用法

<div class="demo">
  <DouColorPicker v-model="color" />
  <DouText variant="tertiary" size="sm">{{ color }}</DouText>
</div>

```vue
<DouColorPicker v-model="color" />
```

值是小写的十六进制色值 `#rrggbb`，字段里显示成大写，方便辨认。拖动时 `v-model` 实时更新，方便预览；弹出层关闭、颜色确实变了时才触发一次 `change`，适合在这里保存。

## 色值格式

`format` 可以是 `hex`（默认）、`rgb`、`hsl`、`hsv`、`hwb`、`lab`、`lch`、`oklab` 或 `oklch`。写出来的都是 CSS Color 4 的空格写法，比如 `rgb(63 86 181)`、`oklch(0.55 0.15 255 / 0.5)`，可以直接用在样式里；`hsv()` 不是 CSS 格式，只是方便和设计工具对照。

<div class="demo">
  <DouSegmentedControl v-model="fmt" :options="formats" size="sm" />
</div>
<div class="demo">
  <DouColorPicker v-model="formatted" :format="fmt" show-alpha />
  <DouText variant="tertiary" size="sm">{{ formatted }}</DouText>
</div>

```vue
<DouColorPicker v-model="color" format="oklch" />
```

传进来的值可以是任意一种格式，旧的逗号写法（`rgba(63, 86, 181, 0.5)`）、百分比、`deg` / `turn` 等角度单位和 `none` 都认得；但用户一动手，写回去的就是 `format` 指定的格式。数值按格式保留合适的位数：`rgb` 取整，`hsl` 一类保留一位小数，`lab` / `lch` 两位，`oklab` / `oklch` 四位。

## 取色面板

`panel` 决定怎么挑：

- `square`（默认）：饱和度与明度的方块，下面是色相条。
- `wheel`：色轮，绕一圈是色相，离圆心越远越饱和，下面是明度条。
- 一个色彩空间的名字，如 `rgb`、`hsl`、`hwb`、`lab`、`oklch`：这个空间的每个通道一条滑块。滑块的底色是"只动这一个通道"时颜色的走向，右边的数字可以直接输入。

<div class="demo">
  <DouColorPicker v-model="wheel" panel="wheel" />
  <DouColorPicker v-model="sliders" panel="oklch" format="oklch" />
</div>

```vue
<DouColorPicker v-model="color" panel="wheel" />
<DouColorPicker v-model="color" panel="oklch" format="oklch" />
```

传一个数组，面板顶上会出一排切换，按用户习惯挑：

<div class="demo">
  <DouColorPicker v-model="multi" :panel="['square', 'wheel', 'oklch', 'rgb']" show-alpha />
</div>

```vue
<DouColorPicker v-model="color" :panel="['square', 'wheel', 'oklch', 'rgb']" />
```

面板在自己的色彩空间里记住颜色，所以灰色的色相、被色域截掉的彩度都不会因为转换而跳走：把 OKLCH 的彩度拖到 0 再拖回来，色相还在原处。

## 色域

`lab`、`lch`、`oklab`、`oklch` 能表示 sRGB 以外的颜色，一些广色域屏幕能显示出来。`gamut` 决定怎么处理它们：

- `srgb`（默认）：超出的颜色按 CSS Color 4 的色域映射，保持亮度和色相、降低彩度，直到落进 sRGB。滑块停在用户拖到的位置，写出去的值是映射后的。
- `none`：Lab 一族的格式原样保留坐标，适合面向广色域屏幕的场景。

`hex`、`rgb`、`hsl`、`hsv`、`hwb` 只能表示 sRGB，无论 `gamut` 怎么设都会映射。

<div class="demo">
  <DouColorPicker v-model="wide" panel="oklch" format="oklch" gamut="none" />
  <DouText variant="tertiary" size="sm">{{ wide }}</DouText>
</div>

```vue
<DouColorPicker v-model="color" panel="oklch" format="oklch" gamut="none" />
```

## 透明度

`show-alpha` 加上透明度条，值变成 `#rrggbbaa` 或 `rgb(… / 0.8)` 这样带透明度的写法（完全不透明时不写透明度）。色样下面垫一层棋盘格，半透明一眼可见。

<div class="demo">
  <DouColorPicker v-model="alpha" show-alpha />
</div>

```vue
<DouColorPicker v-model="color" show-alpha />
```

## 预设色与清空

`presets` 在弹出层底部列出一排色样，点一下直接选中，预设色可以写成任意格式。`clearable` 允许清空，值变成 `null`；`show-text` 为 `false` 时字段只剩色样。

<div class="demo">
  <DouColorPicker v-model="preset" :presets="presets" />
  <DouColorPicker v-model="empty" :presets="presets" clearable />
  <DouColorPicker v-model="preset" :presets="presets" :show-text="false" />
</div>

```vue
<DouColorPicker v-model="color" :presets="['#1f2328', '#3f56b5', '#2e7d5b']" clearable />
```

## 尺寸与状态

<div class="demo">
  <DouColorPicker v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" :model-value="color" />
  <DouColorPicker disabled :model-value="color" />
  <DouColorPicker invalid :model-value="null" />
</div>

## 色值输入

输入框前面的小菜单决定输入框用什么格式显示，默认跟 `format` 一致；切换它只是换个方式看，不会改变 `v-model` 的格式。输入框里只显示括号里的参数（如 `0.55 0.15 255`），格式名由菜单给出。

输入时既可以只写参数，按菜单里的格式理解；也可以写完整的任意格式（如 `#3f56b5` 或 `hsl(228 48% 48%)`）。按 `Enter` 或离开时生效，无法识别的内容恢复成当前色值。

## 键盘与读屏

字段是一个按钮（`aria-haspopup="dialog"`），按 `Enter`、`Space` 或 `↓` 打开并聚焦到第一个滑块，`Esc` 关闭并回到字段。方块、色轮和每一条滑块都是 `role="slider"`，各自带有通道名称：

| 按键             | 行为                                       |
| ---------------- | ------------------------------------------ |
| `←` `→`          | 方块上调饱和度；色轮上转色相；滑块上调整值 |
| `↑` `↓`          | 方块上调明度；色轮上调饱和度；滑块上调整值 |
| `Shift` + 方向键 | 一次走 10%                                 |

方块的 `aria-valuetext` 读出"饱和度 60%，明度 70%"，色轮读出"色相 220°，饱和度 60%"。通道旁的数字框在 `Tab` 顺序之外，用鼠标点进去输入；聚焦后 `↑` `↓` 同样可以调整。

## API

### ColorPicker Props

| 名称          | 说明                                 | 类型                                     | 默认值           |
| ------------- | ------------------------------------ | ---------------------------------------- | ---------------- |
| `modelValue`  | 色值，任意支持的格式，配合 `v-model` | `string \| null`                         | —                |
| `format`      | 写回 `v-model` 的格式                | `ColorFormat`                            | `'hex'`          |
| `panel`       | 取色面板，数组时可以切换             | `ColorPickerPanel \| ColorPickerPanel[]` | `'square'`       |
| `gamut`       | 超出 sRGB 的颜色如何处理             | `'srgb' \| 'none'`                       | `'srgb'`         |
| `showAlpha`   | 可以调透明度                         | `boolean`                                | `false`          |
| `presets`     | 预设色，任意支持的格式               | `string[]`                               | `[]`             |
| `showText`    | 字段里显示色值                       | `boolean`                                | `true`           |
| `placeholder` | 没有颜色时字段里的文字               | `string`                                 | 语言包           |
| `clearable`   | 显示清空按钮                         | `boolean`                                | `false`          |
| `size`        | 尺寸，默认取表单或全局配置           | `'sm' \| 'md' \| 'lg'`                   | `'md'`           |
| `disabled`    | 禁用                                 | `boolean`                                | `false`          |
| `invalid`     | 标记为无效                           | `boolean`                                | `false`          |
| `placement`   | 弹出的位置                           | `Placement`                              | `'bottom-start'` |
| `teleport`    | 渲染到哪里，`false` 留在原处         | `string \| HTMLElement \| false`         | `'body'`         |

### ColorPicker Events

| 名称                | 说明                           | 参数                      |
| ------------------- | ------------------------------ | ------------------------- |
| `update:modelValue` | 颜色变化，拖动时持续触发       | `(value: string \| null)` |
| `change`            | 弹出层关闭时颜色变了，或被清空 | `(value: string \| null)` |

### 类型

```ts
type ColorSpace = 'rgb' | 'hsl' | 'hsv' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch'
type ColorFormat = 'hex' | ColorSpace
type ColorPickerPanel = 'square' | 'wheel' | ColorSpace
```
