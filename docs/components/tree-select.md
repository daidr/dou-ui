# TreeSelect 树选择

从一棵树里选：部门、分类、目录。字段就是 [Select](./select) 的字段，展开后是一棵紧凑的 [Tree](./tree)，放在同样的浮层表面里。

<script setup>
import { ref } from 'vue'
const org = [
  {
    key: 'eng',
    label: '研发中心',
    children: [
      { key: 'fe', label: '前端组', children: [{ key: 'web', label: '官网' }, { key: 'console', label: '控制台' }] },
      { key: 'be', label: '后端组', children: [{ key: 'api', label: '开放接口' }, { key: 'infra', label: '基础设施' }] },
    ],
  },
  { key: 'design', label: '设计部', children: [{ key: 'brand', label: '品牌' }, { key: 'product', label: '产品设计' }] },
  { key: 'ops', label: '运营部' },
]
const team = ref('console')
const leaf = ref(null)
const teams = ref(['fe', 'web', 'console', 'brand'])
const strict = ref(['eng', 'brand'])
const found = ref(null)
</script>

## 基础用法

`data` 与 Tree 相同：`{ key, label, children }`。选中一个节点后列表关闭，字段显示它的标签。

<div class="demo" style="max-width: 360px">
  <DouTreeSelect v-model="team" :data="org" default-expand-all clearable />
</div>

```vue
<DouTreeSelect v-model="team" :data="org" default-expand-all clearable />
```

## 只能选叶子

`leaf-only` 让分支只负责展开收起，只有最末一级可以选中。

<div class="demo" style="max-width: 360px">
  <DouTreeSelect v-model="leaf" :data="org" leaf-only placeholder="选择具体的组" />
</div>

## 多选

`multiple` 给每一行加上复选框。默认勾选是级联的：勾一个分支等于勾上它下面所有节点；一个分支下的节点全被勾上时，字段里只显示这个分支一个标签，删掉它就取消下面所有节点。`v-model` 里始终是全部勾选的 key。

<div class="demo" style="max-width: 420px">
  <DouTreeSelect v-model="teams" :data="org" multiple default-expand-all />
</div>

`check-strictly` 让每个节点单独勾选，互不影响：

<div class="demo" style="max-width: 420px">
  <DouTreeSelect v-model="strict" :data="org" multiple check-strictly default-expand-all />
</div>

```vue
<DouTreeSelect v-model="teams" :data="org" multiple />
<DouTreeSelect v-model="teams" :data="org" multiple check-strictly />
```

## 可搜索

`filterable` 让字段可以输入，树只留下匹配的节点和它们的上级，并自动展开。

<div class="demo" style="max-width: 360px">
  <DouTreeSelect v-model="found" :data="org" filterable placeholder="搜索部门" />
</div>

## 懒加载与大数据

`load` 与 Tree 相同，节点第一次展开时再取子节点；`height` 让树只渲染看得见的行。

```vue
<DouTreeSelect v-model="dir" :data="roots" :load="loadChildren" :height="280" />
```

## 键盘与读屏

字段是 `role="combobox"`，`aria-haspopup="tree"`，用 `aria-controls` 指向树。

| 按键           | 作用                                       |
| -------------- | ------------------------------------------ |
| `↓` / `Enter`  | 打开列表，焦点移进树                       |
| 树里的方向键   | 与 [Tree](./tree) 相同：移动、展开、收起   |
| 树里的 `Enter` | 选中当前节点；多选时用 `Space` 勾选        |
| `Esc`          | 关闭列表，焦点回到字段                     |
| `Backspace`    | 可搜索的多选里，输入为空时删掉最后一个标签 |

## API

### Props

| 名称               | 说明                                | 类型                                | 默认值           |
| ------------------ | ----------------------------------- | ----------------------------------- | ---------------- |
| `modelValue`       | 选中的 key，多选时为勾选的 key 数组 | `TreeKey \| TreeKey[] \| null`      | —                |
| `data`             | 节点                                | `TreeNodeData[]`                    | —                |
| `multiple`         | 多选（复选框）                      | `boolean`                           | `false`          |
| `checkStrictly`    | 多选时每个节点单独勾选              | `boolean`                           | `false`          |
| `leafOnly`         | 只能选中叶子节点                    | `boolean`                           | `false`          |
| `filterable`       | 输入文字筛选节点                    | `boolean`                           | `false`          |
| `defaultExpandAll` | 第一次打开时展开所有分支            | `boolean`                           | `false`          |
| `load`             | 节点第一次展开时取子节点            | `(node) => Promise<TreeNodeData[]>` | —                |
| `height`           | 树的高度；给出后只渲染看得见的行    | `number \| string`                  | —                |
| `placeholder`      | 未选择时的提示                      | `string`                            | 语言包           |
| `size`             | 尺寸，默认取表单或全局配置          | `'sm' \| 'md' \| 'lg'`              | `'md'`           |
| `disabled`         | 禁用                                | `boolean`                           | `false`          |
| `invalid`          | 无效状态                            | `boolean`                           | `false`          |
| `clearable`        | 显示清空按钮                        | `boolean`                           | `false`          |
| `placement`        | 列表首选的位置                      | `Placement`                         | `'bottom-start'` |
| `teleport`         | 列表渲染到哪里；`false` 为原地渲染  | `string \| HTMLElement \| false`    | `'body'`         |
| `ariaLabel`        | 没有可见标签时的读屏名称            | `string`                            | —                |

### Events

| 名称                | 说明                     | 参数                                    |
| ------------------- | ------------------------ | --------------------------------------- |
| `update:modelValue` | 值变化                   | `(value: TreeKey \| TreeKey[] \| null)` |
| `change`            | 用户选择、勾选或移除了项 | `(value: TreeKey \| TreeKey[] \| null)` |
| `clear`             | 按下清空按钮             | —                                       |

### Slots

| 名称     | 说明                                                   |
| -------- | ------------------------------------------------------ |
| `prefix` | 字段里值前面的内容，通常是图标                         |
| `node`   | 树里每一行的内容，参数为 `{ node, selected, checked }` |
| `empty`  | 没有节点或没有匹配时的内容                             |

### 方法

| 名称      | 说明     |
| --------- | -------- |
| `focus()` | 聚焦字段 |
| `blur()`  | 移出焦点 |
