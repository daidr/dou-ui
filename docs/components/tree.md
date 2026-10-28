# Tree 树

展示有层级的数据：文件、组织架构、分类。行是安静的文字，按层级缩进，前面一个小箭头，展开时转向下方。悬停时行下铺一层极淡的底色，选中的行底色稍深、字重变为 medium。树本身没有底色和描边，放在哪个容器里就是哪个容器的样子。

<script setup>
import { ref } from 'vue'

const files = [
  {
    key: 'src',
    label: 'src',
    children: [
      {
        key: 'components',
        label: 'components',
        children: [
          { key: 'button.vue', label: 'button.vue' },
          { key: 'input.vue', label: 'input.vue' },
          { key: 'select.vue', label: 'select.vue' },
        ],
      },
      {
        key: 'composables',
        label: 'composables',
        children: [
          { key: 'use-floating.ts', label: 'use-floating.ts' },
          { key: 'use-layer.ts', label: 'use-layer.ts' },
        ],
      },
      { key: 'index.ts', label: 'index.ts' },
    ],
  },
  { key: 'package.json', label: 'package.json' },
  { key: 'README.md', label: 'README.md' },
]

const expanded = ref(['src', 'components'])
const selected = ref('button.vue')

const org = [
  {
    key: 'eng',
    label: '研发部',
    children: [
      { key: 'fe', label: '前端组', children: [{ key: 'u1', label: '林一' }, { key: 'u2', label: '周二' }] },
      { key: 'be', label: '后端组', children: [{ key: 'u3', label: '陈三' }, { key: 'u4', label: '吴四', disabled: true }] },
    ],
  },
  { key: 'design', label: '设计部', children: [{ key: 'u5', label: '郑五' }] },
]
const checked = ref(['fe'])

const query = ref('use')

function load(node) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        node.key === 'root'
          ? [
              { key: 'root/a', label: 'logs' },
              { key: 'root/b', label: 'cache', isLeaf: true },
            ]
          : [
              { key: `${node.key}/1`, label: '2026-10-27.log', isLeaf: true },
              { key: `${node.key}/2`, label: '2026-10-28.log', isLeaf: true },
            ],
      )
    }, 800)
  })
}
const remote = [{ key: 'root', label: 'var' }]

const big = Array.from({ length: 200 }, (_, i) => ({
  key: `g${i}`,
  label: `分组 ${i + 1}`,
  children: Array.from({ length: 50 }, (_, j) => ({ key: `g${i}-${j}`, label: `条目 ${i + 1}-${j + 1}` })),
}))
</script>

## 基础用法

`data` 是节点数组，每个节点有唯一的 `key`、显示的 `label` 和可选的 `children`。展开的分支用 `v-model:expanded` 绑定，选中的节点用 `v-model:selected` 绑定。

<div class="demo demo--column">
  <DouTree v-model:expanded="expanded" v-model:selected="selected" :data="files" aria-label="文件" />
  <DouText variant="tertiary" size="sm">选中：{{ selected }}</DouText>
</div>

```vue
<DouTree v-model:expanded="expanded" v-model:selected="selected" :data="files" />
```

点击箭头展开或收起，点击行选中。希望点击整行就展开时加上 `expand-on-click`；`selectable` 为 `false` 时点击行直接展开。`default-expand-all` 在首次渲染时展开全部（只在没有绑定 `expanded` 时生效）。

## 层级引导线

`guides` 在每一级子节点前画一条 1px 细线，连到父节点的箭头下方，层级较深时更容易看清从属关系。

<div class="demo demo--column">
  <DouTree :data="files" guides default-expand-all aria-label="文件" />
</div>

## 勾选

`checkable` 在每行前加一个复选框，勾选结果用 `v-model:checked` 绑定。默认会级联：勾选分支会勾选它下面的所有节点（禁用的节点保持原状），分支的子节点全部勾选时它自己也算勾选，部分勾选时显示为短横。`check-strictly` 关闭级联，每个节点各自独立。

<div class="demo demo--column">
  <DouTree v-model:checked="checked" :data="org" checkable :selectable="false" default-expand-all aria-label="成员" />
  <DouText variant="tertiary" size="sm">已勾选：{{ checked.join('、') || '无' }}</DouText>
</div>

```vue
<DouTree v-model:checked="checked" :data="org" checkable :selectable="false" />
```

`checked` 里的分支被视为勾选了它的全部子节点，所以只传 `['fe']` 也会让前端组的成员显示为已勾选；用户操作之后，`checked` 会变成所有已勾选节点的完整列表，按树中的顺序排列。

## 筛选

`filter` 传入文字后，只显示标签包含它的节点和它们的祖先，并自动展开祖先，不改动 `expanded`。匹配的部分加粗并带一条淡下划线。需要其他匹配规则时传 `filter-method`。

<div class="demo demo--column">
  <DouInput v-model="query" placeholder="筛选文件" clearable size="sm" style="max-width: 240px" />
  <DouTree :data="files" :filter="query" aria-label="文件" />
</div>

```vue
<DouInput v-model="query" placeholder="筛选文件" clearable />
<DouTree :data="files" :filter="query" />
```

## 懒加载

传入 `load` 后，没有 `children` 的节点被视为"还没加载"，第一次展开时调用 `load(node)` 取回子节点，期间箭头换成加载指示。已知没有子节点的传 `isLeaf: true`。加载失败时分支收起并触发 `load-error`，下次展开会重新加载。

<div class="demo demo--column">
  <DouTree :data="remote" :load="load" aria-label="目录" />
</div>

```ts
function load(node: TreeNodeData) {
  return api.children(node.key) // Promise<TreeNodeData[]>
}
```

加载回来的子节点保存在组件内部，不会改动传入的 `data`。

## 大量节点

传入 `height` 后只渲染视口附近的行，基于 [VirtualList](./virtual-list)。下面是 200 个分组、各 50 个条目，共一万多个节点。

<div class="demo demo--column">
  <DouTree :data="big" :height="280" guides aria-label="分组" />
</div>

```vue
<DouTree :data="nodes" :height="280" />
```

## 自定义节点

`node` 插槽替换行的内容（箭头和复选框之外的部分），参数为 `{ node, level, expanded, selected, checked, indeterminate }`。

<div class="demo demo--column">
  <DouTree :data="files" :default-expand-all="true" aria-label="文件">
    <template #node="{ node, expanded }">
      <DouIcon :size="14" style="color: var(--dou-color-text-tertiary)">
        <svg v-if="node.children" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25"><path d="M1.75 4.25a1 1 0 011-1h3.5l1.5 1.5h5.5a1 1 0 011 1v6.5a1 1 0 01-1 1H2.75a1 1 0 01-1-1v-8z" stroke-linejoin="round"/></svg>
        <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25"><path d="M9.25 1.75H4.5a1.5 1.5 0 00-1.5 1.5v9.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5V5.5L9.25 1.75z" stroke-linejoin="round"/><path d="M9.25 1.75V5.5H13" stroke-linejoin="round"/></svg>
      </DouIcon>
      <span>{{ node.label }}</span>
      <DouText v-if="node.children" variant="tertiary" size="sm">{{ node.children.length }}</DouText>
    </template>
  </DouTree>
</div>

## 尺寸

行高分别是 24、28、32px。

<div class="demo">
  <DouTree v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" :data="files.slice(1)" style="width: 180px" />
</div>

## 键盘与读屏

容器是 `role="tree"`，每行是 `role="treeitem"`，带 `aria-level`、`aria-setsize`、`aria-posinset`，分支带 `aria-expanded`，可选中时带 `aria-selected`，可勾选时带 `aria-checked`（部分勾选为 `mixed`）。行是平铺渲染的，层级完全由这些属性表达，因此虚拟滚动时读屏器也能读出"第 3 层，共 50 项中的第 12 项"。

焦点始终在树上，当前行通过 `aria-activedescendant` 指出，只在键盘聚焦时画出焦点环。

| 按键         | 行为                                 |
| ------------ | ------------------------------------ |
| `↓` `↑`      | 下一行 / 上一行                      |
| `→`          | 展开分支；已展开时移到第一个子节点   |
| `←`          | 收起分支；已收起或是叶子时移到父节点 |
| `Home` `End` | 第一行 / 最后一行                    |
| `Enter`      | 选中（不可选中时展开或收起）         |
| `Space`      | 勾选（不可勾选时选中）               |
| `*`          | 展开当前行的所有同级分支             |
| 字母         | 跳到下一个以它开头的行               |

## API

### Props

| 名称               | 说明                                    | 类型                                              | 默认值               |
| ------------------ | --------------------------------------- | ------------------------------------------------- | -------------------- |
| `data`             | 节点                                    | `TreeNodeData[]`                                  | —                    |
| `expanded`         | 展开的分支，配合 `v-model:expanded`     | `(string \| number)[]`                            | —                    |
| `selected`         | 选中的节点，配合 `v-model:selected`     | `string \| number \| null`                        | —                    |
| `checked`          | 勾选的节点，配合 `v-model:checked`      | `(string \| number)[]`                            | —                    |
| `selectable`       | 点击行选中                              | `boolean`                                         | `true`               |
| `checkable`        | 每行加复选框                            | `boolean`                                         | `false`              |
| `checkStrictly`    | 勾选不级联                              | `boolean`                                         | `false`              |
| `defaultExpandAll` | 首次渲染时展开全部                      | `boolean`                                         | `false`              |
| `expandOnClick`    | 点击分支行时同时展开或收起              | `boolean`                                         | `false`              |
| `load`             | 首次展开时取回子节点                    | `(node: TreeNodeData) => Promise<TreeNodeData[]>` | —                    |
| `filter`           | 只显示匹配的节点及其祖先                | `string`                                          | —                    |
| `filterMethod`     | 自定义匹配规则                          | `(query: string, node: TreeNodeData) => boolean`  | 标签包含，忽略大小写 |
| `guides`           | 层级引导线                              | `boolean`                                         | `false`              |
| `size`             | 行高，默认取表单或全局配置              | `'sm' \| 'md' \| 'lg'`                            | `'md'`               |
| `height`           | 视口高度，传入后启用虚拟滚动，数字为 px | `number \| string`                                | —                    |
| `ariaLabel`        | 没有可见标题时给读屏器的名称            | `string`                                          | —                    |

### TreeNodeData

| 名称       | 说明                       | 类型               |
| ---------- | -------------------------- | ------------------ |
| `key`      | 整棵树内唯一               | `string \| number` |
| `label`    | 显示的文字，默认为 `key`   | `string`           |
| `children` | 子节点                     | `TreeNodeData[]`   |
| `disabled` | 不可选中、不可勾选         | `boolean`          |
| `isLeaf`   | 懒加载时标记已知没有子节点 | `boolean`          |

节点上的其他属性会原样保留，可以在 `node` 插槽里使用。

### Events

| 名称              | 说明               | 参数                                      |
| ----------------- | ------------------ | ----------------------------------------- |
| `update:expanded` | 展开的分支变化     | `(keys: (string \| number)[])`            |
| `update:selected` | 选中的节点变化     | `(key: string \| number \| null)`         |
| `update:checked`  | 勾选的节点变化     | `(keys: (string \| number)[])`            |
| `select`          | 用户选中了节点     | `(node: TreeNodeData)`                    |
| `check`           | 用户勾选或取消勾选 | `(node: TreeNodeData, checked: boolean)`  |
| `expand`          | 用户展开或收起分支 | `(node: TreeNodeData, expanded: boolean)` |
| `load-error`      | `load` 失败        | `(node: TreeNodeData, error: unknown)`    |

### Slots

| 名称    | 说明                                                                           |
| ------- | ------------------------------------------------------------------------------ |
| `node`  | 行的内容，参数为 `{ node, level, expanded, selected, checked, indeterminate }` |
| `empty` | 没有节点或没有匹配项时显示                                                     |

### Exposes

| 名称          | 说明                     | 类型                                      |
| ------------- | ------------------------ | ----------------------------------------- |
| `focus`       | 聚焦树                   | `() => void`                              |
| `expand`      | 展开这些分支及其祖先     | `(...keys: (string \| number)[]) => void` |
| `collapse`    | 收起这些分支             | `(...keys: (string \| number)[]) => void` |
| `expandAll`   | 展开全部                 | `() => void`                              |
| `collapseAll` | 收起全部                 | `() => void`                              |
| `scrollTo`    | 展开祖先并把节点滚进视口 | `(key: string \| number) => void`         |

### CSS 变量

| 变量                     | 说明                             |
| ------------------------ | -------------------------------- |
| `--dou-tree-row-height`  | 行高（虚拟滚动时以 `size` 为准） |
| `--dou-tree-indent`      | 每一级的缩进                     |
| `--dou-tree-selected-bg` | 选中行的底色                     |
| `--dou-tree-guide`       | 引导线颜色                       |
