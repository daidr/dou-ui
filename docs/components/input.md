# Input 输入框

单行文本输入。输入框是放在页面上的一块表面：细描边加静止阴影，与 outline 按钮同高同质，可以并排对齐。聚焦时描边加深，外面浮现一圈柔和的光晕，而不是生硬的轮廓线。

<script setup>
import { ref } from 'vue'
const text = ref('')
const keyword = ref('dou-ui')
const price = ref('')
</script>

## 基础用法

<div class="demo">
  <DouInput v-model="text" placeholder="项目名称" style="width: 240px" />
  <DouText variant="tertiary" size="sm">当前值：{{ text || '（空）' }}</DouText>
</div>

```vue
<DouInput v-model="name" placeholder="项目名称" />
```

所有未声明为 prop 的属性（`placeholder`、`name`、`autocomplete`、`maxlength`、事件监听等）都会透传给原生 `<input>`；`class` 与 `style` 则作用于外层的输入框表面。

## 尺寸

与按钮共享控件高度 Token，同尺寸的输入框和按钮总是对齐的。

<div class="demo demo--column">
  <DouSpace size="sm"><DouInput size="sm" placeholder="sm" style="width: 200px" /><DouButton size="sm" variant="outline">搜索</DouButton></DouSpace>
  <DouSpace size="sm"><DouInput placeholder="md" style="width: 200px" /><DouButton variant="outline">搜索</DouButton></DouSpace>
  <DouSpace size="sm"><DouInput size="lg" placeholder="lg" style="width: 200px" /><DouButton size="lg" variant="outline">搜索</DouButton></DouSpace>
</div>

## 前缀与后缀

<div class="demo">
  <DouInput v-model="keyword" clearable style="width: 240px">
    <template #prefix>
      <DouIcon><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" stroke-linecap="round" /></svg></DouIcon>
    </template>
  </DouInput>
  <DouInput v-model="price" placeholder="0.00" style="width: 160px">
    <template #prefix>¥</template>
    <template #suffix>元</template>
  </DouInput>
</div>

```vue
<DouInput v-model="keyword" clearable>
  <template #prefix><SearchIcon /></template>
</DouInput>
```

## 可清空

`clearable` 在有内容且可编辑时显示清空按钮；清空后焦点回到输入框，并触发 `clear`。清空按钮的读屏标签来自 [全局配置](./config-provider) 的语言包。

## 状态

<div class="demo demo--column" style="max-width: 280px">
  <DouInput model-value="名称已被占用" invalid />
  <DouInput model-value="只读内容" readonly />
  <DouInput placeholder="禁用" disabled />
</div>

```vue
<DouInput v-model="name" invalid />
<DouInput v-model="name" readonly />
<DouInput v-model="name" disabled />
```

`invalid` 会设置 `aria-invalid`，描边与聚焦光晕切换为危险语气。放在 [表单项](./form) 中时，校验失败会自动进入无效状态，并关联标签与错误信息。

## API

### Props

| 名称         | 说明                       | 类型                                                                        | 默认值   |
| ------------ | -------------------------- | --------------------------------------------------------------------------- | -------- |
| `modelValue` | 绑定值，配合 `v-model`     | `string`                                                                    | `''`     |
| `size`       | 尺寸，默认取表单或全局配置 | `'sm' \| 'md' \| 'lg'`                                                      | `'md'`   |
| `type`       | 原生 `type`                | `'text' \| 'password' \| 'email' \| 'url' \| 'tel' \| 'search' \| 'number'` | `'text'` |
| `disabled`   | 禁用                       | `boolean`                                                                   | `false`  |
| `readonly`   | 只读                       | `boolean`                                                                   | `false`  |
| `invalid`    | 标记为无效                 | `boolean`                                                                   | `false`  |
| `clearable`  | 有内容时显示清空按钮       | `boolean`                                                                   | `false`  |

### Events

| 名称                | 说明         | 参数              |
| ------------------- | ------------ | ----------------- |
| `update:modelValue` | 值变化       | `(value: string)` |
| `clear`             | 点击清空按钮 | —                 |

原生事件（`focus`、`blur`、`keydown` 等）直接监听即可，它们会落在原生 `<input>` 上。

### Slots

| 名称     | 说明                       |
| -------- | -------------------------- |
| `prefix` | 文字前的内容，通常是图标   |
| `suffix` | 文字后的内容，如单位或图标 |

### 实例方法

| 名称     | 说明         | 类型                       |
| -------- | ------------ | -------------------------- |
| `input`  | 原生输入元素 | `HTMLInputElement \| null` |
| `focus`  | 聚焦         | `() => void`               |
| `blur`   | 失焦         | `() => void`               |
| `select` | 选中全部文字 | `() => void`               |

### CSS 变量

| 变量                       | 说明         |
| -------------------------- | ------------ |
| `--dou-input-height`       | 高度         |
| `--dou-input-padding-x`    | 水平内边距   |
| `--dou-input-radius`       | 圆角         |
| `--dou-input-bg`           | 背景色       |
| `--dou-input-border`       | 描边颜色     |
| `--dou-input-border-focus` | 聚焦描边颜色 |
| `--dou-input-ring`         | 聚焦光晕颜色 |
