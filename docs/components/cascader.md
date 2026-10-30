# Cascader 级联选择

当选项具有层级关系时，可以通过级联选择器逐级查看并选择，例如省 / 市 / 区、部门 / 小组。

## 基础用法

<DocDemo src="cascader/basic" />

值是从第一级到最后一级的 `value` 数组。默认只有没有下级的选项可以选中，选中后关闭；字段里显示完整路径，用 `separator` 换分隔符，`show-last-only` 只显示最后一级。

## 选择任意一级

`change-on-select` 让每一级都可以作为结果：点击即选中，同时展开下一级。`expand-trigger="hover"` 让指针停在选项上就展开下一级。

<DocDemo src="cascader/check-strictly" />

## 搜索

`filterable` 把字段变成输入框，输入时在所有完整路径里查找，结果是一列“浙江 / 杭州 / 滨江区”这样的路径。

<DocDemo src="cascader/search" />

## 多选

`multiple` 给每个选项加一个复选框，选中的路径以标签显示在字段里，面板保持打开方便继续勾选。勾选一个分支等于勾选它下面所有的最后一级，值里存的是这些最后一级的路径；下级只勾了一部分时，分支的复选框显示为半选。点击最后一级的文字也能切换勾选，点击分支的文字只展开。懒加载时，勾选一个还没加载的分支会先加载它的下一级。

<DocDemo src="cascader/multiple" />

`check-strictly` 让每一级各自勾选，互不牵连，值里存的就是勾选的那些路径，适合“按省或按市都能选”的场景。`max-tag-count` 和 Select 一样，把多出的标签折叠成“+N”。

<DocDemo src="cascader/multiple-2" />

## 懒加载

`load(option, path)` 在某一项第一次展开时取它的下级，返回 Promise。加载中的选项末尾显示一个小转圈；`leaf: true` 的选项不会再加载。还没加载过的分支不参与搜索。

<DocDemo src="cascader/lazy" />

## 尺寸与状态

<DocDemo src="cascader/size-state" />

## 大量选项

某一列超过 100 个选项时，这一列只渲染看得见的选项。列宽跟着滚动到的最宽选项变宽，不会来回跳动。

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

| 名称             | 说明                                     | 类型                                           | 默认值           |
| ---------------- | ---------------------------------------- | ---------------------------------------------- | ---------------- |
| `modelValue`     | 路径，配合 `v-model`；多选时为路径的数组 | `CascaderValue[] \| CascaderValue[][] \| null` | —                |
| `options`        | 选项树                                   | `CascaderOption[]`                             | `[]`             |
| `load`           | 第一次展开时加载下级                     | `(option, path) => Promise<CascaderOption[]>`  | —                |
| `changeOnSelect` | 每一级都可以选中                         | `boolean`                                      | `false`          |
| `expandTrigger`  | 展开下一级的方式                         | `'click' \| 'hover'`                           | `'click'`        |
| `filterable`     | 可搜索完整路径                           | `boolean`                                      | `false`          |
| `separator`      | 字段里路径的分隔符                       | `string`                                       | `' / '`          |
| `showLastOnly`   | 字段里只显示最后一级                     | `boolean`                                      | `false`          |
| `multiple`       | 多选                                     | `boolean`                                      | `false`          |
| `checkStrictly`  | 多选时每一级各自勾选                     | `boolean`                                      | `false`          |
| `maxTagCount`    | 多选时最多显示几个标签                   | `number`                                       | —                |
| `placeholder`    | 占位文字                                 | `string`                                       | 语言包           |
| `clearable`      | 显示清空按钮                             | `boolean`                                      | `false`          |
| `size`           | 尺寸，默认取表单或全局配置               | `'sm' \| 'md' \| 'lg'`                         | `'md'`           |
| `disabled`       | 禁用                                     | `boolean`                                      | `false`          |
| `invalid`        | 标记为无效                               | `boolean`                                      | `false`          |
| `placement`      | 弹出的位置                               | `Placement`                                    | `'bottom-start'` |
| `teleport`       | 渲染到哪里，`false` 留在原处             | `string \| HTMLElement \| false`               | `'body'`         |

`CascaderOption` 为 `{ value, label?, disabled?, children?, leaf? }`。

### Cascader Events

| 名称                | 说明           | 参数                                                                            |
| ------------------- | -------------- | ------------------------------------------------------------------------------- |
| `update:modelValue` | 值变化         | `(value: CascaderValue[] \| null)`                                              |
| `change`            | 用户选中或清空 | `(value, path: CascaderOption[] \| CascaderOption[][])`，多选时为每条路径的选项 |

### Cascader Slots

| 名称     | 说明                                 |
| -------- | ------------------------------------ |
| `option` | 每个选项，参数为 `{ option, level }` |
| `empty`  | 搜索不到或某一列没有选项时显示       |
