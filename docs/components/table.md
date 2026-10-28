# Table 表格

一组同类记录。表格像卡片一样放在一圈细描边里；表头是压在极淡底色上的小号次要文字，行与行之间是最淡的细线。表格里不出现色相：悬停的行深一点点，选中的行再深一点点。

<script setup>
import { computed, ref } from 'vue'

const columns = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'region', title: '区域' },
  { key: 'status', title: '状态' },
  { key: 'replicas', title: '副本', align: 'end', sortable: true, width: 96 },
  { key: 'updated', title: '更新于', sortable: true, width: 160 },
]
const rows = [
  { id: 1, name: 'edge-fn-sh', region: '上海', status: '运行中', replicas: 3, updated: '2026-10-28 14:32' },
  { id: 2, name: 'api-sg', region: '新加坡', status: '运行中', replicas: 12, updated: '2026-10-28 09:15' },
  { id: 3, name: 'cron-fra', region: '法兰克福', status: '已停止', replicas: 0, updated: '2026-10-27 22:04' },
  { id: 4, name: 'image-iad', region: '弗吉尼亚', status: '部署中', replicas: 2, updated: '2026-10-28 15:01' },
  { id: 5, name: 'auth-sh', region: '上海', status: '运行中', replicas: 6, updated: '2026-10-26 18:40' },
]
const tones = { 运行中: 'success', 已停止: 'neutral', 部署中: 'warning' }
const sort = ref({ key: 'replicas', order: 'desc' })
const selected = ref([2])
const loading = ref(false)
const page = ref(1)
const many = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `worker-${String(i + 1).padStart(2, '0')}`,
  region: ['上海', '新加坡', '法兰克福'][i % 3],
  status: '运行中',
  replicas: (i * 7) % 13,
  updated: '2026-10-28',
}))
const paged = computed(() => many.slice((page.value - 1) * 5, page.value * 5))

const wideColumns = [
  { key: 'name', title: '名称', width: 160, fixed: 'start' },
  { key: 'region', title: '区域', width: 120 },
  { key: 'runtime', title: '运行时', width: 140 },
  { key: 'cpu', title: 'CPU', width: 100, align: 'end' },
  { key: 'memory', title: '内存', width: 120, align: 'end' },
  { key: 'requests', title: '请求 / 分钟', width: 140, align: 'end' },
  { key: 'updated', title: '更新于', width: 180 },
  { key: 'actions', title: '操作', width: 88, fixed: 'end' },
]
const wideRows = rows.map((row, i) => ({
  ...row,
  runtime: ['Node 22', 'Bun 1.4', 'Deno 2'][i % 3],
  cpu: `${(i + 1) * 0.5} 核`,
  memory: `${(i + 1) * 256} MB`,
  requests: ((i + 3) * 1234).toLocaleString('zh-CN'),
}))
const expanded = ref([1])
const treeColumns = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'owner', title: '负责人', width: 120 },
  { key: 'cost', title: '月费用', width: 120, align: 'end', sortable: true },
]
const treeRows = [
  {
    id: 'infra', name: '基础设施', owner: '平台组', cost: 4200,
    children: [
      { id: 'db', name: '数据库', owner: '平台组', cost: 2600, children: [
        { id: 'pg', name: 'PostgreSQL 主库', owner: '小林', cost: 1800 },
        { id: 'redis', name: 'Redis 缓存', owner: '小林', cost: 800 },
      ] },
      { id: 'cdn', name: '内容分发', owner: '阿周', cost: 1600 },
    ],
  },
  {
    id: 'apps', name: '应用', owner: '业务组', cost: 3100,
    children: [
      { id: 'web', name: '官网', owner: '阿周', cost: 900 },
      { id: 'api', name: '开放接口', owner: '小陈', cost: 2200 },
    ],
  },
]
const treeExpanded = ref(['infra'])
const treeSort = ref(null)
const resizeColumns = [
  { key: 'name', title: '名称', width: 180 },
  { key: 'region', title: '区域', width: 140 },
  { key: 'status', title: '状态', width: 120 },
  { key: 'updated', title: '更新于' },
]
const lastResize = ref('')
const summaryColumns = [
  { key: 'name', title: '名称' },
  { key: 'region', title: '区域' },
  { key: 'replicas', title: '副本', align: 'end', width: 96 },
]
const sumReplicas = (all) => ({ name: '合计', replicas: all.reduce((sum, row) => sum + row.replicas, 0) })
const huge = Array.from({ length: 10000 }, (_, i) => ({
  id: i + 1,
  name: `job-${String(i + 1).padStart(5, '0')}`,
  region: ['上海', '新加坡', '法兰克福', '弗吉尼亚'][i % 4],
  duration: `${(i * 37) % 600} 秒`,
}))
const hugeColumns = [
  { key: 'id', title: '#', width: 80, align: 'end' },
  { key: 'name', title: '任务', width: 180 },
  { key: 'region', title: '区域' },
  { key: 'duration', title: '耗时', width: 120, align: 'end' },
]
</script>

## 基础用法

<div class="demo demo--column">
  <DouTable :data="rows" :columns="columns" />
</div>

```vue
<DouTable
  :data="rows"
  :columns="[
    { key: 'name', title: '名称' },
    { key: 'region', title: '区域' },
    { key: 'replicas', title: '副本', align: 'end', width: 96 },
  ]"
/>
```

每一列的 `key` 既是列的标识，也是从行里取值的属性名；需要计算时用 `value: (row) => …`。数字列用 `align: 'end'`，配合等宽数字，位数能对齐。

## 自定义单元格

`cell-<key>` 插槽替换某一列的单元格，参数为 `{ row, column, value, index }`；`cell` 插槽替换所有单元格。表头同理，用 `header-<key>` 与 `header`。

<div class="demo demo--column">
  <DouTable :data="rows" :columns="columns">
    <template #cell-name="{ value }"><DouText mono>{{ value }}</DouText></template>
    <template #cell-status="{ value }"><DouTag :tone="tones[value]" size="sm" round>{{ value }}</DouTag></template>
    <template #cell-updated="{ value }"><DouText variant="tertiary">{{ value }}</DouText></template>
  </DouTable>
</div>

```vue
<DouTable :data="rows" :columns="columns">
  <template #cell-status="{ value }">
    <DouTag :tone="tones[value]" size="sm" round>{{ value }}</DouTag>
  </template>
</DouTable>
```

## 排序

列上的 `sortable` 让表头可以点击排序：升序 → 降序 → 不排序。`true` 按单元格的值比较——数字按大小，文字按页面语言并把其中的数字按数值排（`node-2` 在 `node-10` 前面）；也可以传一个比较两行的函数。当前的排序用 `v-model:sort` 绑定。

<div class="demo demo--column">
  <DouTable v-model:sort="sort" :data="rows" :columns="columns" />
  <DouText variant="tertiary" size="sm">sort：{{ sort }}</DouText>
</div>

```vue
<DouTable v-model:sort="sort" :data="rows" :columns="columns" />
```

数据在服务端排序时加上 `manual-sort`：表格不再改动 `data` 的顺序，只更新 `sort`。

## 选择

`selectable` 在最前面加一列多选框，选中行的 key（由 `row-key` 决定，默认取 `id`）绑定在 `v-model:selected`。传一个函数可以决定哪些行能被选择。表头的框选择全部可选行，部分选中时显示为横线。

<div class="demo demo--column">
  <DouTable v-model:selected="selected" :data="rows" :columns="columns" :selectable="(row) => row.status !== '部署中'" />
  <DouText variant="tertiary" size="sm">selected：{{ selected }}</DouText>
</div>

```vue
<DouTable
  v-model:selected="selected"
  :data="rows"
  :columns="columns"
  :selectable="(row) => row.status !== '部署中'"
/>
```

## 密度、边框与斑马纹

`size` 调整行高：`sm` 36px、`md` 44px、`lg` 52px。`bordered` 在列之间也画细线，`striped` 隔行加底色。

<div class="demo demo--column">
  <DouTable size="sm" bordered striped :data="rows" :columns="columns" />
</div>

## 固定表头、加载与空状态

`max-height` 限制高度，超出后表体滚动、表头固定。`loading` 把行压暗并在上面显示加载动画。没有数据时显示紧凑的 [空状态](./empty)，文字用 `empty-text` 或 `empty` 插槽替换。

<div class="demo demo--column">
  <DouButton size="sm" variant="outline" style="align-self: flex-start" @click="loading = !loading">切换加载</DouButton>
  <DouTable :data="rows" :columns="columns" :max-height="180" :loading="loading" />
  <DouTable :data="[]" :columns="columns" empty-text="还没有实例" />
</div>

## 配合分页

表格本身不分页，把当前页的数据交给它，再在下面放一个 [分页](./pagination)：

<div class="demo demo--column">
  <DouTable :data="paged" :columns="columns" />
  <DouPagination v-model:page="page" :page-size="5" :total="many.length" show-total style="align-self: flex-end" />
</div>

## 固定列

列很多、需要横向滚动时，给关键列加 `fixed: 'start'` 或 `fixed: 'end'`，它们会停在两侧不动。固定列需要数字 `width`，用来算出停靠的位置；内容滑到固定列下面时，交界处出现一道淡淡的阴影。选择列与展开列会跟着靠前的固定列一起停住。

<div class="demo demo--column">
  <DouTable :data="wideRows" :columns="wideColumns" selectable>
    <template #cell-actions>
      <DouLink href="#">详情</DouLink>
    </template>
  </DouTable>
</div>

```ts
const columns = [
  { key: 'name', title: '名称', width: 160, fixed: 'start' },
  // …中间的列
  { key: 'actions', title: '操作', width: 88, fixed: 'end' },
]
```

## 展开行

`expandable` 加一列展开按钮，展开后在这一行下面用 `expand` 插槽显示详情；传函数决定哪些行可以展开。展开的行用 `v-model:expanded` 绑定。

<div class="demo demo--column">
  <DouTable v-model:expanded="expanded" :data="rows" :columns="columns.slice(0, 4)" expandable>
    <template #expand="{ row }">
      <DouDescriptions :column="3" size="sm">
        <DouDescriptionsItem label="实例">{{ row.name }}</DouDescriptionsItem>
        <DouDescriptionsItem label="区域">{{ row.region }}</DouDescriptionsItem>
        <DouDescriptionsItem label="最近更新">{{ row.updated }}</DouDescriptionsItem>
      </DouDescriptions>
    </template>
  </DouTable>
</div>

```vue
<DouTable v-model:expanded="expanded" :data="rows" :columns="columns" expandable>
  <template #expand="{ row }">…</template>
</DouTable>
```

## 树形数据

行里有 `children` 数组时，表格变成一棵树：第一列出现展开按钮，子行逐级缩进。展开的行同样用 `v-model:expanded` 绑定；排序在每一层的兄弟行之间进行。子行属性名可用 `children-key` 修改，缩进用 `indent`。

<div class="demo demo--column">
  <DouTable v-model:expanded="treeExpanded" v-model:sort="treeSort" :data="treeRows" :columns="treeColumns" row-key="id" />
</div>

```vue
<DouTable v-model:expanded="expanded" :data="tree" :columns="columns" />
```

## 调整列宽

`resizable` 让所有列都能拖动表头右边缘调整宽度，也可以只给某一列设 `resizable`。手柄能用 `Tab` 聚焦，`←` `→` 每次调整 8px，按住 `Shift` 为 32px。调整后触发 `columnResize`，可以把宽度存下来。

<div class="demo demo--column">
  <DouTable :data="rows" :columns="resizeColumns" resizable @column-resize="(key, width) => (lastResize = `${key}：${width}px`)" />
  <DouText variant="secondary" size="sm">{{ lastResize || '拖动表头的右边缘试试' }}</DouText>
</div>

```vue
<DouTable :data="rows" :columns="columns" resizable @column-resize="save" />
```

## 合计行

`summary` 接收所有行，返回按列 `key` 排好的值，显示在表格底部；有 `max-height` 时合计行固定在底部。

<div class="demo demo--column">
  <DouTable :data="rows" :columns="summaryColumns" :summary="sumReplicas" />
</div>

```ts
const summary = (rows) => ({
  name: '合计',
  replicas: rows.reduce((sum, row) => sum + row.replicas, 0),
})
```

## 虚拟滚动

上千行时打开 `virtual`，只渲染看得见的那些行。需要 `max-height`；每一行都是 `row-height` 高（默认取当前尺寸的行高）并且只显示一行，展开行在虚拟模式下不显示。下面是一万行。

<div class="demo demo--column">
  <DouTable :data="huge" :columns="hugeColumns" virtual :max-height="360" size="sm" striped />
</div>

```vue
<DouTable :data="rows" :columns="columns" virtual :max-height="360" />
```

## 读屏

表头单元格带 `scope="col"`；可排序的列在 `<th>` 上用 `aria-sort` 标明当前方向，排序的开关是表头里的按钮。选择框各自有读屏名称（"选择全部""选择此行"，来自语言包）。加载中时表格带 `aria-busy`。

展开按钮带 `aria-expanded`，详情行的按钮还用 `aria-controls` 指向详情行。列宽手柄是可聚焦的 `role="separator"`，用 `aria-valuenow` 报告当前宽度。虚拟滚动时表格带 `aria-rowcount`，每一行带 `aria-rowindex`，读屏仍能知道总行数与当前位置。

## API

### Props

| 名称          | 说明                                       | 类型                                              | 默认值         |
| ------------- | ------------------------------------------ | ------------------------------------------------- | -------------- |
| `data`        | 行                                         | `T[]`                                             | —              |
| `columns`     | 列                                         | `TableColumn<T>[]`                                | —              |
| `rowKey`      | 行的唯一键：属性名或函数                   | `string \| ((row: T) => key)`                     | `'id'`         |
| `size`        | 行高密度                                   | `'sm' \| 'md' \| 'lg'`                            | `'md'`         |
| `bordered`    | 列之间也画细线                             | `boolean`                                         | `false`        |
| `striped`     | 隔行加底色                                 | `boolean`                                         | `false`        |
| `hoverable`   | 悬停的行加深                               | `boolean`                                         | `true`         |
| `maxHeight`   | 最大高度，超出后滚动、表头固定；数字为像素 | `number \| string`                                | —              |
| `loading`     | 加载中                                     | `boolean`                                         | `false`        |
| `emptyText`   | 空状态文字，默认取语言包的"暂无数据"       | `string`                                          | —              |
| `selectable`  | 加一列多选框；函数决定哪些行可选           | `boolean \| ((row: T) => boolean)`                | `false`        |
| `selected`    | 选中行的 key，`v-model:selected`           | `(string \| number)[]`                            | `[]`           |
| `sort`        | 排序，`v-model:sort`                       | `{ key: string; order: 'asc' \| 'desc' } \| null` | `null`         |
| `manualSort`  | 不改动 `data` 的顺序，只报告 `sort`        | `boolean`                                         | `false`        |
| `expandable`  | 加一列展开按钮；函数决定哪些行可展开       | `boolean \| ((row: T) => boolean)`                | `false`        |
| `expanded`    | 展开的行（详情与树形），`v-model:expanded` | `(string \| number)[]`                            | `[]`           |
| `childrenKey` | 子行所在的属性                             | `string`                                          | `'children'`   |
| `indent`      | 树形每一层的缩进，像素                     | `number`                                          | `16`           |
| `resizable`   | 所有列都可拖动调整宽度                     | `boolean`                                         | `false`        |
| `summary`     | 合计行的值，按列 `key`                     | `(rows: T[]) => Record<string, unknown>`          | —              |
| `virtual`     | 只渲染看得见的行，需要 `maxHeight`         | `boolean`                                         | `false`        |
| `rowHeight`   | 虚拟滚动时每一行的高度，像素               | `number`                                          | 当前尺寸的行高 |

### TableColumn

| 名称        | 说明                                     | 类型                                  |
| ----------- | ---------------------------------------- | ------------------------------------- |
| `key`       | 列的标识，也是取值的属性名               | `string`                              |
| `title`     | 表头文字                                 | `string`                              |
| `value`     | 从行里取值                               | `(row: T) => unknown`                 |
| `width`     | 宽度；数字为像素                         | `number \| string`                    |
| `minWidth`  | 最小宽度                                 | `number \| string`                    |
| `align`     | 对齐                                     | `'start' \| 'center' \| 'end'`        |
| `sortable`  | 可排序；函数比较两行                     | `boolean \| ((a: T, b: T) => number)` |
| `ellipsis`  | 单行显示，超出部分省略                   | `boolean`                             |
| `fixed`     | 横向滚动时停在一侧，需要数字 `width`     | `'start' \| 'end'`                    |
| `resizable` | 可拖动调整宽度，优先于表格的 `resizable` | `boolean`                             |

### Events

| 名称              | 说明         | 参数                                         |
| ----------------- | ------------ | -------------------------------------------- |
| `update:selected` | 选中行变化   | `(keys: (string \| number)[])`               |
| `update:sort`     | 排序变化     | `(sort: TableSort \| null)`                  |
| `rowClick`        | 点击了某一行 | `(row: T, index: number, event: MouseEvent)` |
| `update:expanded` | 展开的行变化 | `(keys: (string \| number)[])`               |
| `columnResize`    | 调整了列宽   | `(key: string, width: number)`               |

### Slots

| 名称           | 说明                                                   |
| -------------- | ------------------------------------------------------ |
| `cell-<key>`   | 某一列的单元格，参数为 `{ row, column, value, index }` |
| `cell`         | 所有单元格                                             |
| `header-<key>` | 某一列的表头，参数为 `{ column }`                      |
| `header`       | 所有表头                                               |
| `empty`        | 替换空状态                                             |
| `expand`       | 展开行的详情，参数为 `{ row, index }`                  |

### CSS 变量

| 变量                         | 说明                   |
| ---------------------------- | ---------------------- |
| `--dou-table-cell-height`    | 行高                   |
| `--dou-table-cell-padding-x` | 单元格水平内边距       |
| `--dou-table-head-bg`        | 表头底色               |
| `--dou-table-row-hover`      | 悬停行底色             |
| `--dou-table-row-selected`   | 选中行底色             |
| `--dou-table-fixed-shadow`   | 固定列交界处的阴影颜色 |
