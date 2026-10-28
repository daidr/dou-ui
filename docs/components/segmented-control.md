# SegmentedControl 分段控制器

在几个互斥的选项里选一个，是 [单选框组](./radio) 的另一种外观：所有选项排在一道凹进的轨道里，选中的那一段是一块凸起的表面——细描边加静止阴影——并在选项之间滑动。它与同尺寸的按钮等高，适合切换视图、时间粒度这类"立即生效"的选择。

<script setup>
import { ref } from 'vue'
const view = ref('list')
const range = ref('周')
const region = ref('hk')
</script>

## 基础用法

<div class="demo">
  <DouSegmentedControl
    v-model="view"
    :options="[
      { value: 'list', label: '列表' },
      { value: 'board', label: '看板' },
      { value: 'timeline', label: '时间线' },
    ]"
  />
  <DouText variant="tertiary" size="sm">当前值：{{ view }}</DouText>
</div>

```vue
<DouSegmentedControl
  v-model="view"
  :options="[
    { value: 'list', label: '列表' },
    { value: 'board', label: '看板' },
    { value: 'timeline', label: '时间线' },
  ]"
/>
```

选项可以直接写成字符串或数字，此时它既是值也是标签：

<div class="demo">
  <DouSegmentedControl v-model="range" :options="['日', '周', '月', '年']" />
</div>

```vue
<DouSegmentedControl v-model="range" :options="['日', '周', '月', '年']" />
```

## 撑满宽度

`block` 让控件撑满父元素，各选项平分宽度。

<div class="demo demo--column" style="max-width: 420px">
  <DouSegmentedControl
    v-model="region"
    block
    :options="[
      { value: 'hk', label: '香港' },
      { value: 'sg', label: '新加坡' },
      { value: 'fra', label: '法兰克福' },
      { value: 'iad', label: '弗吉尼亚', disabled: true },
    ]"
  />
</div>

## 自定义选项

`option` 插槽替换每个选项的内容，例如加上图标。插槽参数为 `{ option, checked }`。

<div class="demo">
  <DouSegmentedControl v-model="view" :options="[{ value: 'list', label: '列表' }, { value: 'board', label: '看板' }]">
    <template #option="{ option }">
      <DouIcon v-if="option.value === 'list'"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M3 8h10M3 12h10" stroke-linecap="round" /></svg></DouIcon>
      <DouIcon v-else><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="3" width="4" height="10" rx="1" /><rect x="9.5" y="3" width="4" height="6" rx="1" /></svg></DouIcon>
      {{ option.label }}
    </template>
  </DouSegmentedControl>
</div>

## 尺寸与禁用

<div class="demo demo--column">
  <DouSpace v-for="size in ['sm', 'md', 'lg']" :key="size" size="sm">
    <DouSegmentedControl v-model="range" :size="size" :options="['日', '周', '月']" />
    <DouButton :size="size" variant="outline">导出</DouButton>
  </DouSpace>
  <DouSpace size="sm">
    <DouSegmentedControl model-value="周" disabled :options="['日', '周', '月']" />
  </DouSpace>
</div>

## 键盘与读屏

每个选项都是一个原生单选框，共享同一个 `name`：`Tab` 进入时聚焦当前选项，方向键在选项之间移动并立即选中，与单选框组完全一致。外层带有 `role="radiogroup"`；放在 [表单项](./form) 中时，由表单项的标签通过 `aria-labelledby` 命名。

## API

### Props

| 名称         | 说明                               | 类型                                             | 默认值  |
| ------------ | ---------------------------------- | ------------------------------------------------ | ------- |
| `modelValue` | 选中值，配合 `v-model`             | `string \| number \| boolean`                    | —       |
| `options`    | 选项；字符串或数字同时作为值和标签 | `(SegmentedControlOption \| string \| number)[]` | —       |
| `size`       | 尺寸，默认取表单或全局配置         | `'sm' \| 'md' \| 'lg'`                           | `'md'`  |
| `block`      | 撑满宽度，选项平分                 | `boolean`                                        | `false` |
| `disabled`   | 禁用全部                           | `boolean`                                        | `false` |
| `name`       | 原生 `name`，不传时自动生成        | `string`                                         | —       |

`SegmentedControlOption` 为 `{ value: string | number | boolean; label?: string; disabled?: boolean }`。

### Events

| 名称                | 说明             | 参数                                   |
| ------------------- | ---------------- | -------------------------------------- |
| `update:modelValue` | 值变化           | `(value: string \| number \| boolean)` |
| `change`            | 用户选了另一个项 | `(value: string \| number \| boolean)` |

### Slots

| 名称     | 说明                                   |
| -------- | -------------------------------------- |
| `option` | 选项内容，参数为 `{ option, checked }` |

### CSS 变量

| 变量                                   | 说明               |
| -------------------------------------- | ------------------ |
| `--dou-segmented-control-height`       | 高度               |
| `--dou-segmented-control-padding-x`    | 选项水平内边距     |
| `--dou-segmented-control-inset`        | 轨道与选中块的间距 |
| `--dou-segmented-control-bg`           | 轨道底色           |
| `--dou-segmented-control-indicator-bg` | 选中块底色         |
