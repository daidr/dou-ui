# Transfer 穿梭框

在两列之间挪动条目：左边是待选，右边是已选。每一列是一张细描边的卡片，顶部是全选框、标题和计数，中间的两个小按钮把勾选的条目移到另一边。列表只渲染看得见的行，几千条也不会卡。

<script setup>
import { ref } from 'vue'
const people = Array.from({ length: 40 }, (_, i) => ({
  key: i + 1,
  label: `成员 ${String(i + 1).padStart(2, '0')}`,
  description: ['设计', '前端', '后端', '产品'][i % 4],
  disabled: i % 9 === 8,
}))
const chosen = ref([3, 7])
const searchable = ref([])
const many = Array.from({ length: 5000 }, (_, i) => ({ key: i, label: `条目 ${i + 1}` }))
const manyChosen = ref([])
</script>

## 基础用法

<div class="demo">
  <DouTransfer v-model="chosen" :data="people" />
</div>

```vue
<DouTransfer v-model="chosen" :data="people" />
```

`data` 是全部条目 `{ key, label, description?, disabled? }`，`v-model` 是右侧条目的 `key` 数组，顺序就是右侧的顺序；新移过去的条目排在末尾。禁用的条目不能勾选，也不会被全选带上。

## 搜索与标题

`filterable` 在每一列上方加一个搜索框，默认按标签包含输入的文字匹配，`filter` 可以自定义。全选只作用于当前筛选出来的条目。`titles` 替换两列的标题。

<div class="demo">
  <DouTransfer v-model="searchable" :data="people" filterable :titles="['全部成员', '项目成员']" />
</div>

```vue
<DouTransfer v-model="value" :data="people" filterable :titles="['全部成员', '项目成员']" />
```

## 大量数据

列表建在 VirtualList 上，行高固定 32px，`height` 指定列表的高度（默认 240）。

<div class="demo">
  <DouTransfer v-model="manyChosen" :data="many" filterable :height="200" />
</div>

## 插槽

`item` 自定义每一行的标签（参数 `{ item, direction }`），`footer` 放在每一列的底部（参数 `{ direction }`），例如放一个"重置"按钮。

## 键盘与读屏

每一列是一个带名称的 `<section>`，条目是普通的复选框，可以用 `Tab` 和 `Space` 操作；列表本身可以滚动聚焦。移动按钮在没有勾选时禁用，并带有"移到右侧""移到左侧"的名称。

## API

### Transfer Props

| 名称         | 说明                             | 类型                       | 默认值   |
| ------------ | -------------------------------- | -------------------------- | -------- |
| `data`       | 全部条目                         | `TransferItem[]`           | `[]`     |
| `modelValue` | 右侧条目的 `key`，配合 `v-model` | `(string \| number)[]`     | `[]`     |
| `titles`     | 两列的标题                       | `[string, string]`         | 语言包   |
| `filterable` | 每列上方显示搜索框               | `boolean`                  | `false`  |
| `filter`     | 条目与搜索文字的匹配方式         | `(item, query) => boolean` | 标签包含 |
| `height`     | 列表高度（px）                   | `number`                   | `240`    |
| `disabled`   | 禁用                             | `boolean`                  | `false`  |

### Transfer Events

| 名称                | 说明         | 参数                                                             |
| ------------------- | ------------ | ---------------------------------------------------------------- |
| `update:modelValue` | 右侧条目变化 | `(value: TransferKey[])`                                         |
| `change`            | 条目被移动   | `(value, direction: 'source' \| 'target', moved: TransferKey[])` |

### Transfer Slots

| 名称     | 说明                                       |
| -------- | ------------------------------------------ |
| `item`   | 每一行的标签，参数为 `{ item, direction }` |
| `footer` | 每列底部，参数为 `{ direction }`           |
