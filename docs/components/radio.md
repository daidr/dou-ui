# Radio 单选框

在一组互斥的选项中选择一个。

<script setup>
import { ref } from 'vue'
const plan = ref('pro')
const region = ref('sh')
</script>

## 基础用法

把选项放进 `DouRadioGroup`，`v-model` 是被选中选项的 `value`。组会为选项生成共享的 `name`，因此方向键切换、表单提交等行为都由浏览器原生处理。

<div class="demo demo--column">
  <DouRadioGroup v-model="plan">
    <DouRadio value="hobby">个人版</DouRadio>
    <DouRadio value="pro">专业版</DouRadio>
    <DouRadio value="team">团队版</DouRadio>
  </DouRadioGroup>
  <DouText variant="tertiary" size="sm">当前：{{ plan }}</DouText>
</div>

```vue
<DouRadioGroup v-model="plan">
  <DouRadio value="hobby">个人版</DouRadio>
  <DouRadio value="pro">专业版</DouRadio>
  <DouRadio value="team">团队版</DouRadio>
</DouRadioGroup>
```

## 垂直排列

<div class="demo">
  <DouRadioGroup v-model="region" direction="vertical">
    <DouRadio value="sh">华东（上海）</DouRadio>
    <DouRadio value="sz">华南（深圳）</DouRadio>
    <DouRadio value="bj" disabled>华北（北京）· 维护中</DouRadio>
  </DouRadioGroup>
</div>

## 尺寸与禁用

<div class="demo">
  <DouRadioGroup model-value="a" size="sm"><DouRadio value="a">sm</DouRadio></DouRadioGroup>
  <DouRadioGroup model-value="a"><DouRadio value="a">md</DouRadio></DouRadioGroup>
  <DouRadioGroup model-value="a" size="lg"><DouRadio value="a">lg</DouRadio></DouRadioGroup>
  <DouRadioGroup model-value="a" disabled>
    <DouRadio value="a">禁用且选中</DouRadio>
    <DouRadio value="b">禁用</DouRadio>
  </DouRadioGroup>
</div>

单个 `DouRadio` 也可以脱离组使用 `v-model`，此时需要自己给同一组选项设置相同的 `name`。

## API

### Radio Props

| 名称         | 说明                               | 类型                          | 默认值  |
| ------------ | ---------------------------------- | ----------------------------- | ------- |
| `value`      | 选项代表的值（必填）               | `string \| number \| boolean` | —       |
| `modelValue` | 不在组中时的选中值，配合 `v-model` | `string \| number \| boolean` | —       |
| `disabled`   | 禁用                               | `boolean`                     | `false` |
| `size`       | 尺寸，默认继承组                   | `'sm' \| 'md' \| 'lg'`        | `'md'`  |
| `name`       | 原生 `name`，组内使用组的名字      | `string`                      | —       |

### RadioGroup Props

| 名称         | 说明                        | 类型                          | 默认值         |
| ------------ | --------------------------- | ----------------------------- | -------------- |
| `modelValue` | 选中值，配合 `v-model`      | `string \| number \| boolean` | —              |
| `disabled`   | 禁用全部                    | `boolean`                     | `false`        |
| `size`       | 尺寸                        | `'sm' \| 'md' \| 'lg'`        | —              |
| `direction`  | 排列方向                    | `'horizontal' \| 'vertical'`  | `'horizontal'` |
| `name`       | 原生 `name`，不传时自动生成 | `string`                      | —              |

### Events

| 组件            | 名称                | 参数                                   |
| --------------- | ------------------- | -------------------------------------- |
| `DouRadio`      | `update:modelValue` | `(value: string \| number \| boolean)` |
| `DouRadioGroup` | `update:modelValue` | `(value: string \| number \| boolean)` |

### CSS 变量

| 变量                  | 说明             |
| --------------------- | ---------------- |
| `--dou-radio-tone`    | 选中时的底色     |
| `--dou-radio-tone-on` | 选中时圆点的颜色 |
| `--dou-radio-size`    | 直径             |
