# Textarea 多行输入

多行文本输入，是 [输入框](./input) 的多行版本：同样的表面、细描边、静止阴影和聚焦光晕。行高取整数像素，上下内边距按尺寸挑选，使**单行时恰好与同尺寸的输入框等高**。

<script setup>
import { ref } from 'vue'
const bio = ref('')
const note = ref('输入的内容越多，输入框就越高。\n超过最大行数后改为滚动。')
const summary = ref('一个为自己打造的 Vue 3 组件库')
</script>

## 基础用法

<div class="demo demo--column" style="max-width: 420px">
  <DouTextarea v-model="bio" placeholder="介绍一下这个项目" />
  <DouText variant="tertiary" size="sm">已输入 {{ bio.length }} 个字符</DouText>
</div>

```vue
<DouTextarea v-model="bio" placeholder="介绍一下这个项目" />
```

所有未声明为 prop 的属性（`placeholder`、`name`、`maxlength`、事件监听等）都会透传给原生 `<textarea>`；`class` 与 `style` 作用于外层的表面。

## 自适应高度

`autosize` 让输入框随内容增高。可以传入 `minRows` 与 `maxRows` 限定范围，超过最大行数后出现滚动条。开启后不再允许拖拽调整大小。

<div class="demo demo--column" style="max-width: 420px">
  <DouTextarea v-model="note" :autosize="{ minRows: 2, maxRows: 5 }" />
</div>

```vue
<DouTextarea v-model="note" autosize />
<DouTextarea v-model="note" :autosize="{ minRows: 2, maxRows: 5 }" />
```

输入框在隐藏状态下（如折叠面板里）无法测量，显示出来后可调用实例方法 `resizeToContent()` 重新计算。

## 字数统计

`showCount` 在右下角显示已输入的字符数；同时设置了 `maxlength` 时显示为 `已输入 / 上限`。统计按用户看到的字符计数，一个 emoji 算一个。

<div class="demo demo--column" style="max-width: 420px">
  <DouTextarea v-model="summary" show-count maxlength="60" :rows="2" />
</div>

```vue
<DouTextarea v-model="summary" show-count maxlength="60" />
```

## 尺寸与状态

<div class="demo demo--column" style="max-width: 420px">
  <DouSpace size="sm" align="start" block>
    <DouTextarea size="sm" :rows="1" placeholder="sm · 1 行" />
    <DouInput size="sm" placeholder="sm 输入框" />
  </DouSpace>
  <DouTextarea model-value="内容格式不正确" invalid :rows="2" />
  <DouTextarea model-value="只读内容" readonly :rows="2" />
  <DouTextarea placeholder="禁用" disabled :rows="2" />
</div>

```vue
<DouTextarea size="sm" :rows="1" />
<DouTextarea v-model="text" invalid />
<DouTextarea v-model="text" readonly />
<DouTextarea v-model="text" disabled />
```

放在 [表单项](./form) 中时，多行输入会接收表单项的 `id` 与说明文字，在失焦时触发校验；出错后每次输入都会重新校验。

## API

### Props

| 名称         | 说明                                               | 类型                                                | 默认值       |
| ------------ | -------------------------------------------------- | --------------------------------------------------- | ------------ |
| `modelValue` | 绑定值，配合 `v-model`                             | `string`                                            | `''`         |
| `size`       | 尺寸，默认取表单或全局配置                         | `'sm' \| 'md' \| 'lg'`                              | `'md'`       |
| `rows`       | 不自适应时的可见行数                               | `number`                                            | `3`          |
| `autosize`   | 随内容增高，可限定最少 / 最多行数                  | `boolean \| { minRows?: number; maxRows?: number }` | `false`      |
| `resize`     | 允许拖拽调整的方向，开启 `autosize` 时固定为不允许 | `'none' \| 'vertical' \| 'horizontal' \| 'both'`    | `'vertical'` |
| `showCount`  | 显示字数统计                                       | `boolean`                                           | `false`      |
| `disabled`   | 禁用                                               | `boolean`                                           | `false`      |
| `readonly`   | 只读                                               | `boolean`                                           | `false`      |
| `invalid`    | 标记为无效                                         | `boolean`                                           | `false`      |

### Events

| 名称                | 说明   | 参数              |
| ------------------- | ------ | ----------------- |
| `update:modelValue` | 值变化 | `(value: string)` |

原生事件（`focus`、`blur`、`keydown` 等）直接监听即可，它们会落在原生 `<textarea>` 上。

### 实例方法

| 名称              | 说明               | 类型                          |
| ----------------- | ------------------ | ----------------------------- |
| `textarea`        | 原生多行输入元素   | `HTMLTextAreaElement \| null` |
| `focus`           | 聚焦               | `() => void`                  |
| `blur`            | 失焦               | `() => void`                  |
| `select`          | 选中全部文字       | `() => void`                  |
| `resizeToContent` | 按当前内容重新测量 | `() => void`                  |

### CSS 变量

| 变量                          | 说明         |
| ----------------------------- | ------------ |
| `--dou-textarea-line-height`  | 行高         |
| `--dou-textarea-padding-y`    | 垂直内边距   |
| `--dou-textarea-padding-x`    | 水平内边距   |
| `--dou-textarea-bg`           | 背景色       |
| `--dou-textarea-border`       | 描边颜色     |
| `--dou-textarea-border-focus` | 聚焦描边颜色 |
| `--dou-textarea-ring`         | 聚焦光晕颜色 |
