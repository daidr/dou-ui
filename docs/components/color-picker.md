# ColorPicker 颜色选择

挑选一个颜色。字段是一块色样加上色值；弹出层上方是饱和度与亮度的面板，下面是色相条和（可选的）透明度条，再往下是可以直接编辑的色值和预设色。

<script setup>
import { ref } from 'vue'
const color = ref('#3f56b5')
const alpha = ref('#2e7d5bcc')
const preset = ref('#a8572d')
const presets = ['#1f2328', '#3f56b5', '#2e7d5b', '#a8572d', '#b23a48', '#7a4fb5', '#5c6670', '#c99a2e']
const empty = ref(null)
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

## 透明度

`show-alpha` 加上透明度条，值变成 `#rrggbbaa`（完全不透明时仍是 `#rrggbb`）。色样下面垫一层棋盘格，半透明一眼可见。

<div class="demo">
  <DouColorPicker v-model="alpha" show-alpha />
</div>

```vue
<DouColorPicker v-model="color" show-alpha />
```

## 预设色与清空

`presets` 在弹出层底部列出一排色样，点一下直接选中。`clearable` 允许清空，值变成 `null`；`show-text` 为 `false` 时字段只剩色样。

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

弹出层里的输入框接受 `#rgb`、`#rrggbb` 和 `#rrggbbaa`（`#` 可省略），按 `Enter` 或离开时生效；无法识别的内容恢复成当前色值。

## 键盘与读屏

字段是一个按钮（`aria-haspopup="dialog"`），按 `Enter`、`Space` 或 `↓` 打开并聚焦到面板，`Esc` 关闭并回到字段。面板、色相条和透明度条都是 `role="slider"`：

| 按键             | 行为                                    |
| ---------------- | --------------------------------------- |
| `←` `→`          | 面板上调饱和度；色相 / 透明度条上调整值 |
| `↑` `↓`          | 面板上调亮度；色相 / 透明度条上调整值   |
| `Shift` + 方向键 | 一次走 10%                              |

面板的 `aria-valuetext` 读出"饱和度 60%，亮度 70%"。

## API

### ColorPicker Props

| 名称          | 说明                         | 类型                             | 默认值           |
| ------------- | ---------------------------- | -------------------------------- | ---------------- |
| `modelValue`  | 色值，配合 `v-model`         | `string \| null`                 | —                |
| `showAlpha`   | 可以调透明度                 | `boolean`                        | `false`          |
| `presets`     | 预设色                       | `string[]`                       | `[]`             |
| `showText`    | 字段里显示色值               | `boolean`                        | `true`           |
| `placeholder` | 没有颜色时字段里的文字       | `string`                         | 语言包           |
| `clearable`   | 显示清空按钮                 | `boolean`                        | `false`          |
| `size`        | 尺寸，默认取表单或全局配置   | `'sm' \| 'md' \| 'lg'`           | `'md'`           |
| `disabled`    | 禁用                         | `boolean`                        | `false`          |
| `invalid`     | 标记为无效                   | `boolean`                        | `false`          |
| `placement`   | 弹出的位置                   | `Placement`                      | `'bottom-start'` |
| `teleport`    | 渲染到哪里，`false` 留在原处 | `string \| HTMLElement \| false` | `'body'`         |

### ColorPicker Events

| 名称                | 说明                           | 参数                      |
| ------------------- | ------------------------------ | ------------------------- |
| `update:modelValue` | 颜色变化，拖动时持续触发       | `(value: string \| null)` |
| `change`            | 弹出层关闭时颜色变了，或被清空 | `(value: string \| null)` |
