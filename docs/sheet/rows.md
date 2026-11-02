# 行、列与合并

调整行高列宽，插入、删除、移动和隐藏行列，把行列分组折叠，以及合并单元格。

## 合并单元格

工作表的 `merges` 列出合并的区域，例如 `['A1:B1']`。合并后显示左上角单元格的内容，其余单元格被盖住。

<DocDemo src="sheet/merge" column />

- 选区碰到合并区域时会扩大到把它整个包含进来，方向键移动时把合并区域当作一个单元格。
- 在右键菜单里选“合并单元格”或“取消合并”。
- 合并时只保留左上角的内容，其余单元格的值被清空（样式保留），表格会提示清空了几个单元格，撤销可以恢复。
- 插入、删除、移动行列时，合并区域跟着移动和伸缩，缩到只剩一个单元格时自动取消。

用代码合并时调用 `tr.mergeCells('A1:B2')`，传 `{ keep: true }` 时把其余单元格的值留在合并单元格下面，取消合并后重新显示；`tr.unmergeCells('A1')` 取消合并。

## 调整大小

- 拖动列标右边线或行号下边线调整宽度和高度，双击边线按内容自动调整。
- 选中多列（多行）时调整其中一列，所有选中的列一起改变。
- 拖到几乎为 0 会隐藏这一列。

## 移动

选中整行（整列）后，拖动行号（列标）把它们移到别处，拖动时显示放下的位置。

## 插入、删除与隐藏

右键行号或列标，菜单里有插入、删除、隐藏和取消隐藏。右键普通单元格时，插入和删除收在“插入”“删除”两个子菜单里，行和列都有。

- 插入的数量和选中的行数（列数）一样。会删光所有行（列）时不提供删除。
- 隐藏的行和列在行号、列标之间显示为一条双线，选中它两边的行（列）后在菜单里取消隐藏。
- 插入、删除发生在冻结区域内时，冻结的行数和列数跟着变化。工作表设置了 `rowCount`、`colCount` 时，行数、列数也随之增减。
- 所有工作表里指向这些单元格的公式引用都会随之改写，见[用代码修改 · 公式引用](./transactions#公式引用)。

## 右键菜单

触屏上长按单元格不拖动，松开后打开菜单；键盘上按菜单键或 `Shift` + `F10`。

`menu` 属性可以修改菜单：它收到表格准备显示的菜单项和打开的位置，返回实际显示的菜单项。可以删掉、调整顺序，或加上自己的菜单项：

```vue
<script setup lang="ts">
import type { SheetMenuContext, SheetMenuItem } from '@dou-ui/sheet'

function menu(items: SheetMenuItem[], context: SheetMenuContext) {
  const own: SheetMenuItem = {
    key: 'link',
    label: '复制单元格链接',
    divided: true,
    run: () => copyLink(context.selection.active),
  }
  return context.area === 'cell' ? [...items, own] : items
}
</script>

<template>
  <DouSheet v-model="book" :menu="menu" />
</template>
```

- `context.area` 是 `cell`、`row`、`col` 或 `corner`，整行、整列被选中时按行号、列标算。
- `context.selection` 是菜单作用的选区。
- 菜单项的 `children` 显示为子菜单。

要在多个表格里加同样的菜单项，用扩展的 `contextMenu`，见[命令与工具栏按钮](./commands)。

## 分组

几行或几列可以归成一组，折叠起来只看汇总。

<DocDemo src="sheet/groups" column />

- 表格左侧（列分组在上方）有一条括线和一个按钮，点按钮折叠或展开这一组。
- 分组可以嵌套，最多 8 层。行号上方和列标左边的数字按钮按层级显示：点 1 折叠所有分组，点最大的数字全部展开。
- `outline` 设为 `false` 隐藏大纲栏，例如在窄屏上留出空间。分组仍然可以用右键菜单和快捷键操作。

分组写在工作表的 `groups` 里。`range` 是整行（`'3:8'`）或整列（`'B:D'`），`collapsed` 为 `true` 时折叠：

```ts
const sheet = {
  name: '销售额',
  groups: [{ range: '3:9' }, { range: '4:6' }, { range: '8:9', collapsed: true }, { range: 'C:F' }],
  cells: [],
}
```

按钮默认放在分组的前一行（列分组在前一列），这一行通常是小计或标题。小计在明细下方时，把工作表的 `groupSummary` 设为 `'after'`，按钮就放在分组的后一行（后一列）。这一行不存在，或者属于旁边的另一个分组时，按钮放到分组的另一侧。

### 在界面上分组

选中行或列后，在右键菜单里分组、取消分组或折叠，也可以按 `Alt` + `Shift` + `→` 分组、`Alt` + `Shift` + `←` 取消分组。选中整列时作用于列，否则作用于行。

- 新的分组和同一层紧挨着的分组合成一个分组。
- 取消分组每次去掉一层，有嵌套时先去掉外层。范围里没有完整的分组时，这些行从包住它们的最内层分组里拿出来，分组可能因此分成两段。
- 分组不能和已有的分组交叉，嵌套也不能超过 8 层，这时表格会提示原因。

折叠的行列和隐藏的行列一样不显示，也不会出现在导出的图片和打印里。插入、删除、移动行列时，分组跟着移动和伸缩。只读的表格也可以折叠和展开，但只影响当前的显示，不修改数据。

## API

### 事务方法

在 `transact` 里调用，见[用代码修改](./transactions)。

| 方法                                                         | 说明                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `setSize('row' \| 'col', i, px, sheet?)`                     | 设置行高、列宽，`undefined` 恢复默认，`0` 隐藏                                            |
| `insertRows(at, count?, sheet?)`、`insertCols`               | 在 `at` 前插入空行（列），`at` 是序号或 `'5:6'`、`'C'` 这样的写法                         |
| `deleteRows(at, count?, sheet?)`、`deleteCols`               | 删除行（列）及其中的单元格和尺寸                                                          |
| `moveRows(lines, to, sheet?)`、`moveCols`                    | 把行（列）移到 `to` 之前，`to` 按移动前编号；`lines` 是序号、`'2:3'` 或 `{ from, count }` |
| `mergeCells(range, { keep? })`、`unmergeCells(range)`        | 合并区域；取消区域碰到的所有合并                                                          |
| `groupRows(at, count?, sheet?)`、`groupCols`                 | 分组，如 `groupRows('3:8')`；和已有分组交叉或超过 8 层时抛出 `RangeError`                 |
| `ungroupRows(at, count?, sheet?)`、`ungroupCols`             | 取消分组，规则和菜单里一样                                                                |
| `collapseGroup(range, sheet?)`、`expandGroup(range, sheet?)` | 折叠、展开一个分组，没有这个分组时抛出 `RangeError`                                       |
| `showGroupLevel('row' \| 'col', level, sheet?)`              | 按层级显示，和数字按钮一样                                                                |

### SheetMenuItem

`menu` 属性、扩展的 `contextMenu` 和工具栏按钮的 `children` 都用这种菜单项。

| 属性       | 说明                                                                           | 类型                    |
| ---------- | ------------------------------------------------------------------------------ | ----------------------- |
| `key`      | 在菜单里唯一                                                                   | `string`                |
| `command`  | 运行的[命令](./commands)；名称、图标、快捷键和能否运行都取自命令，除非这里另写 | `string`                |
| `label`    | 显示的文字，没有 `command` 时必填                                              | `string`                |
| `icon`     | 图标                                                                           | `Component`             |
| `shortcut` | 显示在旁边的快捷键，如 `mod+c`；触屏上不显示                                   | `string`                |
| `tone`     | 颜色，`danger` 用于删除之类的操作                                              | `'neutral' \| 'danger'` |
| `divided`  | 上方加一条分隔线                                                               | `boolean`               |
| `disabled` | 是否禁用                                                                       | `boolean`               |
| `children` | 子菜单的项；有子菜单的项没有 `run`                                             | `SheetMenuItem[]`       |
| `run`      | 点击时运行                                                                     | `() => void`            |

### SheetMenuContext

| 属性        | 说明               | 类型                                   |
| ----------- | ------------------ | -------------------------------------- |
| `area`      | 在哪里打开的菜单   | `'cell' \| 'row' \| 'col' \| 'corner'` |
| `selection` | 菜单作用的选区     | `SheetSelection`                       |
| `sheet`     | 显示的工作表的序号 | `number`                               |
