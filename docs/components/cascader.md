# Cascader 级联选择

从一棵有层级的选项里选出一条路径，例如省 / 市 / 区，或部门 / 小组。弹出层是并排的几列，每选中一项，右边打开它的下一级；有下级的选项末尾是一个小箭头，正在展开的那一项带一层淡淡的底色。

<script setup>
import { ref } from 'vue'
const regions = [
  {
    value: 'zj',
    label: '浙江',
    children: [
      { value: 'hz', label: '杭州', children: [{ value: 'xh', label: '西湖区' }, { value: 'bj', label: '滨江区' }, { value: 'yh', label: '余杭区' }] },
      { value: 'nb', label: '宁波', children: [{ value: 'hs', label: '海曙区' }, { value: 'yz', label: '鄞州区' }] },
      { value: 'wz', label: '温州', disabled: true },
    ],
  },
  {
    value: 'js',
    label: '江苏',
    children: [
      { value: 'nj', label: '南京', children: [{ value: 'xw', label: '玄武区' }, { value: 'gl', label: '鼓楼区' }] },
      { value: 'sz', label: '苏州', children: [{ value: 'gs', label: '姑苏区' }, { value: 'wz', label: '吴中区' }] },
    ],
  },
  { value: 'sh', label: '上海', children: [{ value: 'pd', label: '浦东新区' }, { value: 'xh', label: '徐汇区' }] },
]
const region = ref(['zj', 'hz', 'xh'])
const any = ref(null)
const searched = ref(null)
const lazy = ref(null)
let id = 0
const load = (option, path) =>
  new Promise((resolve) =>
    setTimeout(() => {
      const level = path.length
      resolve(Array.from({ length: 3 }, () => ({ value: ++id, label: `第 ${level + 1} 级 · ${id}`, leaf: level >= 2 })))
    }, 500),
  )
const roots = [{ value: 'a', label: '分组 A' }, { value: 'b', label: '分组 B' }]
</script>

## 基础用法

<div class="demo">
  <DouCascader v-model="region" :options="regions" style="width: 260px" />
  <DouText variant="tertiary" size="sm">{{ region }}</DouText>
</div>

```vue
<DouCascader v-model="region" :options="regions" />
```

值是从第一级到最后一级的 `value` 数组。默认只有没有下级的选项可以选中，选中后关闭；字段里显示完整路径，用 `separator` 换分隔符，`show-last-only` 只显示最后一级。

## 选择任意一级

`change-on-select` 让每一级都可以作为结果：点击即选中，同时展开下一级。`expand-trigger="hover"` 让指针停在选项上就展开下一级。

<div class="demo">
  <DouCascader v-model="any" :options="regions" change-on-select expand-trigger="hover" clearable placeholder="地区（任意一级）" style="width: 260px" />
</div>

```vue
<DouCascader v-model="value" :options="regions" change-on-select expand-trigger="hover" />
```

## 搜索

`filterable` 把字段变成输入框，输入时在所有完整路径里查找，结果是一列"浙江 / 杭州 / 滨江区"这样的路径。

<div class="demo">
  <DouCascader v-model="searched" :options="regions" filterable placeholder="输入地区名称" style="width: 260px" />
</div>

```vue
<DouCascader v-model="value" :options="regions" filterable />
```

## 懒加载

`load(option, path)` 在某一项第一次展开时取它的下级，返回 Promise。加载中的选项末尾显示一个小转圈；`leaf: true` 的选项不会再加载。还没加载过的分支不参与搜索。

<div class="demo">
  <DouCascader v-model="lazy" :options="roots" :load="load" style="width: 260px" />
</div>

```vue
<DouCascader v-model="value" :options="roots" :load="loadChildren" />
```

## 尺寸与状态

<div class="demo">
  <DouCascader v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" :options="regions" :model-value="['sh', 'pd']" style="width: 180px" />
  <DouCascader disabled :options="regions" :model-value="['sh', 'pd']" style="width: 180px" />
  <DouCascader invalid :options="regions" style="width: 180px" />
</div>

## 键盘与读屏

字段是 `role="combobox"`（开启 `filterable` 时是其中的输入框），每一列是一个 `role="listbox"`；有下级的选项带 `aria-expanded`，高亮的选项通过 `aria-activedescendant` 告诉读屏，焦点始终留在字段上。

| 按键            | 行为                      |
| --------------- | ------------------------- |
| `↓` `↑`         | 打开 / 在当前列里移动     |
| `Home` `End`    | 当前列的第一项 / 最后一项 |
| `→`             | 展开下一级                |
| `←`             | 回到上一级                |
| `Enter` `Space` | 选中；有下级时展开        |
| `Esc`           | 收起                      |

## API

### Cascader Props

| 名称             | 说明                         | 类型                                          | 默认值           |
| ---------------- | ---------------------------- | --------------------------------------------- | ---------------- |
| `modelValue`     | 路径，配合 `v-model`         | `(string \| number)[] \| null`                | —                |
| `options`        | 选项树                       | `CascaderOption[]`                            | `[]`             |
| `load`           | 第一次展开时加载下级         | `(option, path) => Promise<CascaderOption[]>` | —                |
| `changeOnSelect` | 每一级都可以选中             | `boolean`                                     | `false`          |
| `expandTrigger`  | 展开下一级的方式             | `'click' \| 'hover'`                          | `'click'`        |
| `filterable`     | 可搜索完整路径               | `boolean`                                     | `false`          |
| `separator`      | 字段里路径的分隔符           | `string`                                      | `' / '`          |
| `showLastOnly`   | 字段里只显示最后一级         | `boolean`                                     | `false`          |
| `placeholder`    | 占位文字                     | `string`                                      | 语言包           |
| `clearable`      | 显示清空按钮                 | `boolean`                                     | `false`          |
| `size`           | 尺寸，默认取表单或全局配置   | `'sm' \| 'md' \| 'lg'`                        | `'md'`           |
| `disabled`       | 禁用                         | `boolean`                                     | `false`          |
| `invalid`        | 标记为无效                   | `boolean`                                     | `false`          |
| `placement`      | 弹出的位置                   | `Placement`                                   | `'bottom-start'` |
| `teleport`       | 渲染到哪里，`false` 留在原处 | `string \| HTMLElement \| false`              | `'body'`         |

`CascaderOption` 为 `{ value, label?, disabled?, children?, leaf? }`。

### Cascader Events

| 名称                | 说明           | 参数                               |
| ------------------- | -------------- | ---------------------------------- |
| `update:modelValue` | 值变化         | `(value: CascaderValue[] \| null)` |
| `change`            | 用户选中或清空 | `(value, path: CascaderOption[])`  |

### Cascader Slots

| 名称     | 说明                                 |
| -------- | ------------------------------------ |
| `option` | 每个选项，参数为 `{ option, level }` |
| `empty`  | 搜索不到或某一列没有选项时显示       |
