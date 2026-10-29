# Rate 评分

用星星给出或展示评分。

<script setup>
import { HeartIcon } from '@dou-ui/icons'
import { ref } from 'vue'
const score = ref(3)
const half = ref(3.5)
const clearable = ref(4)
const warm = ref(4)
</script>

## 基础用法

<div class="demo">
  <DouRate v-model="score" aria-label="满意度" />
  <DouText variant="tertiary" size="sm">{{ score }}</DouText>
</div>

```vue
<DouRate v-model="score" aria-label="满意度" />
```

值是数字，`0` 表示还没有评分。指针悬停时预览将要选中的分数。

## 半星与清除

`allow-half` 允许半星：点在星星左半边就是半颗。`clearable` 让再次点击当前分数时清零。

<div class="demo">
  <DouRate v-model="half" allow-half />
  <DouRate v-model="clearable" clearable />
</div>

```vue
<DouRate v-model="value" allow-half />
<DouRate v-model="value" clearable />
```

## 语气、文字与图标

`tone="warning"` 用暖色填充。默认插槽显示在星星后面，参数是当前分数；`icon` 插槽替换星星本身，它同样会画两次（空的一层和填满后裁剪的一层），所以用 `currentColor` 的线条或实心图形都可以。

<div class="demo">
  <DouRate v-model="warm" tone="warning">
    <template #default="{ value }"><DouText variant="secondary" size="sm">{{ value }} 分</DouText></template>
  </DouRate>
  <DouRate v-model="warm">
    <template #icon>
      <HeartIcon />
    </template>
  </DouRate>
</div>

```vue
<DouRate v-model="value" tone="warning">
  <template #default="{ value }">{{ value }} 分</template>
</DouRate>
```

## 尺寸与状态

`readonly` 只展示分数，`disabled` 同时变灰。

<div class="demo">
  <DouRate v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" :model-value="3.5" allow-half readonly />
  <DouRate :model-value="2" disabled />
</div>

## 键盘与读屏

整排星星是一个 `role="slider"`，`aria-valuetext` 读出"3 星，共 5 星"。没有可见标签时用 `aria-label` 命名；在 `DouFormItem` 里会自动关联标签。

| 按键      | 行为                              |
| --------- | --------------------------------- |
| `→` `↑`   | 加一颗星（`allow-half` 时加半颗） |
| `←` `↓`   | 减一颗星（`allow-half` 时减半颗） |
| `Home`    | 清零                              |
| `End`     | 满分                              |
| `0` – `9` | 直接设为这个分数                  |

## API

### Rate Props

| 名称         | 说明                       | 类型                     | 默认值      |
| ------------ | -------------------------- | ------------------------ | ----------- |
| `modelValue` | 分数，配合 `v-model`       | `number`                 | `0`         |
| `max`        | 星星个数                   | `number`                 | `5`         |
| `allowHalf`  | 允许半星                   | `boolean`                | `false`     |
| `clearable`  | 再次点击当前分数时清零     | `boolean`                | `false`     |
| `readonly`   | 只展示，不可修改           | `boolean`                | `false`     |
| `disabled`   | 禁用                       | `boolean`                | `false`     |
| `size`       | 尺寸，默认取表单或全局配置 | `'sm' \| 'md' \| 'lg'`   | `'md'`      |
| `tone`       | 填充的颜色                 | `'neutral' \| 'warning'` | `'neutral'` |
| `ariaLabel`  | 没有可见标签时的名称       | `string`                 | —           |

### Rate Events

| 名称                | 说明         | 参数              |
| ------------------- | ------------ | ----------------- |
| `update:modelValue` | 分数变化     | `(value: number)` |
| `change`            | 用户改了分数 | `(value: number)` |

### Rate Slots

| 名称      | 说明                               |
| --------- | ---------------------------------- |
| `default` | 星星后面的内容，参数为 `{ value }` |
| `icon`    | 替换星星，参数为 `{ index }`       |
