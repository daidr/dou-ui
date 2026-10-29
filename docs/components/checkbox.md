# Checkbox 多选框

在一组选项中选择任意多个，或单独表示"是 / 否"。

原生 `<input type="checkbox">` 始终保留在原位，点击、键盘与表单行为都由浏览器提供。选中后的样式与实心按钮一致。

<script setup>
import { computed, ref } from 'vue'
const agreed = ref(true)
const all = ['邮件', '短信', '站内信']
const channels = ref(['邮件'])
const allChecked = computed({
  get: () => channels.value.length === all.length,
  set: (value) => (channels.value = value ? [...all] : []),
})
const partly = computed(() => channels.value.length > 0 && channels.value.length < all.length)
</script>

## 基础用法

<div class="demo">
  <DouCheckbox v-model="agreed">我已阅读并同意服务条款</DouCheckbox>
</div>

```vue
<DouCheckbox v-model="agreed">我已阅读并同意服务条款</DouCheckbox>
```

## 多选组

在 `DouCheckboxGroup` 中，`v-model` 是被选中选项的 `value` 数组。

<div class="demo demo--column">
  <DouCheckbox v-model="allChecked" :indeterminate="partly">全部渠道</DouCheckbox>
  <DouCheckboxGroup v-model="channels">
    <DouCheckbox v-for="item in all" :key="item" :value="item">{{ item }}</DouCheckbox>
  </DouCheckboxGroup>
  <DouText variant="tertiary" size="sm">已选：{{ channels.join('、') || '无' }}</DouText>
</div>

```vue
<DouCheckbox v-model="allChecked" :indeterminate="partly">全部渠道</DouCheckbox>
<DouCheckboxGroup v-model="channels">
  <DouCheckbox value="邮件">邮件</DouCheckbox>
  <DouCheckbox value="短信">短信</DouCheckbox>
  <DouCheckbox value="站内信">站内信</DouCheckbox>
</DouCheckboxGroup>
```

`indeterminate` 只影响外观（并同步到原生元素，读屏软件会读作"部分选中"），点击仍然切换 `modelValue`。

## 尺寸与禁用

<div class="demo">
  <DouCheckbox size="sm" :model-value="true">sm</DouCheckbox>
  <DouCheckbox :model-value="true">md</DouCheckbox>
  <DouCheckbox size="lg" :model-value="true">lg</DouCheckbox>
  <DouCheckbox disabled>禁用</DouCheckbox>
  <DouCheckbox disabled :model-value="true">禁用且选中</DouCheckbox>
</div>

组上的 `size`、`disabled`、`name` 会传给组内的每一项；单项上的设置优先。

## API

### Checkbox Props

| 名称            | 说明                                           | 类型                   | 默认值  |
| --------------- | ---------------------------------------------- | ---------------------- | ------- |
| `modelValue`    | 是否选中，配合 `v-model`；组内忽略             | `boolean`              | `false` |
| `value`         | 在组中代表的值                                 | `string \| number`     | —       |
| `indeterminate` | 部分选中的外观                                 | `boolean`              | `false` |
| `disabled`      | 禁用                                           | `boolean`              | `false` |
| `size`          | 尺寸，默认继承组                               | `'sm' \| 'md' \| 'lg'` | `'md'`  |
| `name`          | 原生 `name`，默认继承组                        | `string`               | —       |
| `ariaLabel`     | 没有可见标签时的读屏名称，如表格里选择一行的框 | `string`               | —       |

### CheckboxGroup Props

| 名称         | 说明                       | 类型                         | 默认值         |
| ------------ | -------------------------- | ---------------------------- | -------------- |
| `modelValue` | 选中项的值，配合 `v-model` | `(string \| number)[]`       | `[]`           |
| `disabled`   | 禁用全部                   | `boolean`                    | `false`        |
| `size`       | 尺寸                       | `'sm' \| 'md' \| 'lg'`       | —              |
| `direction`  | 排列方向                   | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `name`       | 统一的原生 `name`          | `string`                     | —              |

### Events

| 组件               | 名称                | 参数                            |
| ------------------ | ------------------- | ------------------------------- |
| `DouCheckbox`      | `update:modelValue` | `(value: boolean)`              |
| `DouCheckboxGroup` | `update:modelValue` | `(value: (string \| number)[])` |

### CSS 变量

| 变量                     | 说明             |
| ------------------------ | ---------------- |
| `--dou-checkbox-tone`    | 选中时的底色     |
| `--dou-checkbox-tone-on` | 选中时勾号的颜色 |
| `--dou-checkbox-size`    | 方框边长         |
