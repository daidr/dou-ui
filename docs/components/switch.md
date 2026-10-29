# Switch 开关

在开和关两种状态之间切换，切换后立即生效。

<script setup>
import { ref } from 'vue'
const notify = ref(true)
const sync = ref(false)
const saving = ref(false)
function toggleSync(value) {
  saving.value = true
  setTimeout(() => {
    sync.value = value
    saving.value = false
  }, 1200)
}
</script>

## 基础用法

<div class="demo">
  <DouSwitch v-model="notify">接收通知</DouSwitch>
</div>

```vue
<DouSwitch v-model="notify">接收通知</DouSwitch>
```

开关渲染为 `role="switch"` 的原生按钮，`aria-checked` 反映状态，标签文字通过 `aria-labelledby` 关联；点击标签同样会切换。

## 尺寸

<div class="demo">
  <DouSwitch size="sm" :model-value="true">sm</DouSwitch>
  <DouSwitch :model-value="true">md</DouSwitch>
  <DouSwitch size="lg" :model-value="true">lg</DouSwitch>
  <DouSwitch size="lg" />
</div>

## 加载与禁用

切换需要等待服务端确认时，用 `loading` 显示指示器并暂时忽略操作；与按钮一致，加载中的开关**仍可获得焦点**。

<div class="demo">
  <DouSwitch :model-value="sync" :loading="saving" @update:model-value="toggleSync">云端同步</DouSwitch>
  <DouSwitch disabled>禁用</DouSwitch>
  <DouSwitch disabled :model-value="true">禁用且打开</DouSwitch>
</div>

```vue
<DouSwitch :model-value="sync" :loading="saving" @update:model-value="save">
  云端同步
</DouSwitch>
```

## API

### Props

| 名称         | 说明                       | 类型                   | 默认值  |
| ------------ | -------------------------- | ---------------------- | ------- |
| `modelValue` | 是否打开，配合 `v-model`   | `boolean`              | `false` |
| `disabled`   | 禁用                       | `boolean`              | `false` |
| `loading`    | 加载中，忽略操作但可聚焦   | `boolean`              | `false` |
| `size`       | 尺寸                       | `'sm' \| 'md' \| 'lg'` | `'md'`  |
| `ariaLabel`  | 没有可见标签时给读屏的名字 | `string`               | —       |

### Events

| 名称                | 说明     | 参数               |
| ------------------- | -------- | ------------------ |
| `update:modelValue` | 状态切换 | `(value: boolean)` |

### Slots

| 名称      | 说明                     |
| --------- | ------------------------ |
| `default` | 标签文字，点击同样会切换 |

### CSS 变量

| 变量                   | 说明           |
| ---------------------- | -------------- |
| `--dou-switch-tone`    | 打开时轨道颜色 |
| `--dou-switch-tone-on` | 打开时滑块颜色 |
| `--dou-switch-width`   | 轨道宽度       |
| `--dou-switch-height`  | 轨道高度       |
