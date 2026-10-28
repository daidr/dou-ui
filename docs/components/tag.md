# Tag 标签

标记状态与元信息。标签依附于内容而不作用于内容，所以它比按钮更安静：默认是浅底，边缘更细。

## 变体与语气

<div class="demo">
  <DouTag>soft</DouTag>
  <DouTag variant="outline">outline</DouTag>
  <DouTag variant="solid">solid</DouTag>
</div>

<div class="demo">
  <DouTag tone="primary">primary</DouTag>
  <DouTag tone="success">success</DouTag>
  <DouTag tone="warning">warning</DouTag>
  <DouTag tone="danger">danger</DouTag>
  <DouTag variant="outline" tone="success">outline</DouTag>
  <DouTag variant="solid" tone="danger">solid</DouTag>
</div>

```vue
<DouTag tone="success">已部署</DouTag>
<DouTag variant="outline">beta</DouTag>
```

## 尺寸与圆角

<div class="demo">
  <DouTag size="sm">sm</DouTag>
  <DouTag>md</DouTag>
  <DouTag size="lg">lg</DouTag>
  <DouTag round tone="primary">12</DouTag>
  <DouTag round variant="outline">
    <template #leading><span class="dot dot--success" /></template>
    运行中
  </DouTag>
</div>

```vue
<DouTag round variant="outline">
  <template #leading><StatusDot /></template>
  运行中
</DouTag>
```

## 可移除

`closable` 显示一个移除按钮，点击时触发 `close`，由使用者决定是否真的移除。

<script setup>
import { ref } from 'vue'
const tags = ref(['vue', 'bun', 'vite', 'css'])
</script>

<div class="demo">
  <DouTag v-for="tag in tags" :key="tag" closable @close="tags = tags.filter((t) => t !== tag)">{{ tag }}</DouTag>
  <DouButton v-if="tags.length < 4" variant="ghost" size="sm" @click="tags = ['vue', 'bun', 'vite', 'css']">重置</DouButton>
</div>

```vue
<DouTag v-for="tag in tags" :key="tag" closable @close="remove(tag)">
  {{ tag }}
</DouTag>
```

## API

### Props

| 名称       | 说明         | 类型                                                           | 默认值      |
| ---------- | ------------ | -------------------------------------------------------------- | ----------- |
| `variant`  | 视觉权重     | `'soft' \| 'outline' \| 'solid'`                               | `'soft'`    |
| `tone`     | 语义         | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `size`     | 尺寸         | `'sm' \| 'md' \| 'lg'`                                         | `'md'`      |
| `closable` | 显示移除按钮 | `boolean`                                                      | `false`     |
| `round`    | 两端完全圆角 | `boolean`                                                      | `false`     |

### Events

| 名称    | 说明         | 参数                  |
| ------- | ------------ | --------------------- |
| `close` | 点击移除按钮 | `(event: MouseEvent)` |

### Slots

| 名称      | 说明                         |
| --------- | ---------------------------- |
| `default` | 标签文字                     |
| `leading` | 文字前的内容，如图标、状态点 |

### CSS 变量

| 变量                  | 说明               |
| --------------------- | ------------------ |
| `--dou-tag-tone`      | 基础色             |
| `--dou-tag-tone-on`   | 实心背景上的前景色 |
| `--dou-tag-height`    | 高度               |
| `--dou-tag-padding-x` | 水平内边距         |
| `--dou-tag-radius`    | 圆角               |
