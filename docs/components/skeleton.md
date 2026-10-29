# Skeleton 骨架屏

在数据加载完成前，用占位图形表示内容的大致结构。

<script setup>
import { ref } from 'vue'
const loading = ref(true)
</script>

## 基础用法

`variant` 可选 `text`（默认，按 `lines` 画几行，最后一行短一些）、`rect`（一块矩形）、`circle`（头像）。

<div class="demo demo--column" style="max-width: 480px">
  <DouSpace align="start" size="md" block>
    <DouSkeleton variant="circle" :width="40" />
    <DouSkeleton :lines="3" style="flex: 1" />
  </DouSpace>
  <DouSkeleton variant="rect" :height="120" />
</div>

```vue
<DouSkeleton variant="circle" :width="40" />
<DouSkeleton :lines="3" />
<DouSkeleton variant="rect" :height="120" />
```

## 加载完成后显示内容

把真实内容放进默认插槽，`loading` 为 `false` 时显示它。

<div class="demo demo--column" style="max-width: 480px">
  <DouSwitch v-model="loading">加载中</DouSwitch>
  <DouSkeleton :loading="loading" :lines="2">
    <DouText as="p" variant="secondary">最近一次部署于 3 分钟前完成，所有检查均已通过。</DouText>
  </DouSkeleton>
</div>

```vue
<DouSkeleton :loading="loading" :lines="2">
  <p>最近一次部署于 3 分钟前完成。</p>
</DouSkeleton>
```

## 读屏

占位本身带 `aria-hidden="true"`。请在包含它的区域上设置 `aria-busy="true"`，加载完成后移除。

## API

### Props

| 名称       | 说明                                   | 类型                           | 默认值   |
| ---------- | -------------------------------------- | ------------------------------ | -------- |
| `variant`  | 形状                                   | `'text' \| 'rect' \| 'circle'` | `'text'` |
| `lines`    | `text` 的行数                          | `number`                       | `1`      |
| `width`    | 宽度；数字为 px                        | `string \| number`             | —        |
| `height`   | 高度；数字为 px，`circle` 默认等于宽度 | `string \| number`             | —        |
| `loading`  | 显示占位；为 `false` 时显示默认插槽    | `boolean`                      | `true`   |
| `animated` | 光扫过的动画                           | `boolean`                      | `true`   |

### CSS 变量

| 变量                    | 说明       |
| ----------------------- | ---------- |
| `--dou-skeleton-bg`     | 占位底色   |
| `--dou-skeleton-shine`  | 扫光颜色   |
| `--dou-skeleton-radius` | 文字行圆角 |
