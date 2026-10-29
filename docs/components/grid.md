# Grid 栅格

基于 CSS Grid 的栅格布局，列数和跨列数可以随视口宽度变化。

<style>
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: 6px;
  color: var(--dou-color-text-tertiary);
  font-size: 13px;
}
</style>

## 基础用法

`cols` 设定列数，子元素默认各占一列。`gap` 取 `sm` / `md` / `lg` 或任意 CSS 长度（数字为像素），传一对值分别设置行距和列距。

<div class="demo demo--column">
  <DouGrid :cols="4" gap="md">
    <div v-for="i in 8" :key="i" class="cell">{{ i }}</div>
  </DouGrid>
</div>

```vue
<DouGrid :cols="4" gap="md">
  <div v-for="i in 8" :key="i">{{ i }}</div>
</DouGrid>
```

## 跨列

`DouGridItem` 的 `span` 设定跨几列，`full` 占满一整行；`start` 指定从第几列开始；`rowSpan` 跨行。

<div class="demo demo--column">
  <DouGrid :cols="12" gap="sm">
    <DouGridItem span="full"><div class="cell">full</div></DouGridItem>
    <DouGridItem :span="8"><div class="cell">8</div></DouGridItem>
    <DouGridItem :span="4"><div class="cell">4</div></DouGridItem>
    <DouGridItem :span="6" :start="4"><div class="cell">start 4 · span 6</div></DouGridItem>
  </DouGrid>
</div>

```vue
<DouGrid :cols="12" gap="sm">
  <DouGridItem span="full">…</DouGridItem>
  <DouGridItem :span="8">…</DouGridItem>
  <DouGridItem :span="4">…</DouGridItem>
  <DouGridItem :span="6" :start="4">…</DouGridItem>
</DouGrid>
```

## 响应式

`cols`、`span` 与 `start` 都可以写成按断点取值的对象。断点从小到大是 `sm` 640px、`md` 768px、`lg` 1024px、`xl` 1280px，每个断点从它的宽度起生效，`base` 用于最小的屏幕；没写的断点沿用比它小的那个。调整窗口宽度看效果。

<div class="demo demo--column">
  <DouGrid :cols="{ base: 1, sm: 2, lg: 4 }" gap="md">
    <DouGridItem :span="{ base: 1, lg: 2 }"><div class="cell">lg 起占两列</div></DouGridItem>
    <div v-for="i in 5" :key="i" class="cell">{{ i }}</div>
  </DouGrid>
</div>

```vue
<DouGrid :cols="{ base: 1, sm: 2, lg: 4 }">
  <DouGridItem :span="{ base: 1, lg: 2 }">…</DouGridItem>
  …
</DouGrid>
```

## 自动填充

`minItemWidth` 让每列至少这么宽，能放几列就放几列，适合卡片列表。它会取代 `cols`。

<div class="demo demo--column">
  <DouGrid :min-item-width="160" gap="md">
    <div v-for="i in 7" :key="i" class="cell">{{ i }}</div>
  </DouGrid>
</div>

```vue
<DouGrid :min-item-width="160">…</DouGrid>
```

## API

### Grid Props

| 名称           | 说明                             | 类型                                        | 默认值      |
| -------------- | -------------------------------- | ------------------------------------------- | ----------- |
| `cols`         | 列数                             | `Responsive<number>`                        | `1`         |
| `minItemWidth` | 每列的最小宽度，自动决定列数     | `number \| string`                          | —           |
| `gap`          | 格子间距，一对值分别为行距与列距 | `GridGap \| [GridGap, GridGap]`             | `'md'`      |
| `align`        | 同一行格子的垂直对齐             | `'start' \| 'center' \| 'end' \| 'stretch'` | `'stretch'` |

`GridGap` 为 `'sm' | 'md' | 'lg' | number | string`。`Responsive<T>` 为 `T` 或 `{ base?, sm?, md?, lg?, xl? }`。

### GridItem Props

| 名称      | 说明                    | 类型                           | 默认值 |
| --------- | ----------------------- | ------------------------------ | ------ |
| `span`    | 跨几列，`full` 占满一行 | `Responsive<number \| 'full'>` | `1`    |
| `start`   | 从第几列开始，从 1 计   | `Responsive<number>`           | —      |
| `rowSpan` | 跨几行                  | `number`                       | —      |
