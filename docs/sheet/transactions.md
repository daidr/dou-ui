# 用代码修改

组件实例的 `transact` 把多处修改合成一次提交，撤销时也作为一步。

## 基础用法

```vue
<script setup lang="ts">
import { DouSheet } from '@dou-ui/sheet'
import { useTemplateRef } from 'vue'

const sheet = useTemplateRef<InstanceType<typeof DouSheet>>('sheet')

function fill() {
  sheet.value?.transact((tr) => {
    tr.setValue('A5', '鼠标')
    tr.updateCell('B5', { value: 98, format: '#,##0' })
    tr.setValue("'表 2'!A1", '汇总') // 指定工作表
    tr.setValue({ row: 4, col: 2 }, true) // 用坐标，即 C5
    tr.setSize('col', 0, 140)
  })
}
</script>

<template>
  <DouSheet ref="sheet" v-model="book" />
</template>
```

<DocDemo src="sheet/transact" column />

`transact` 总是返回这次的事务：

- 没有改动时 `tr.changed` 为 `false`。
- 被保护或[扩展取消](./extensions#取消修改)时 `tr.cancelled` 为 `true`，`tr.cancelReason` 是原因。
- 对比历史版本时（传了 `compare`）表格不接受修改，返回被取消的事务。

`readonly` 只限制使用者在表格里的操作，代码调用 `transact`、`undo`、`redo` 照常生效。

## 指定单元格

- 单元格用名字（`'A5'`）或从 0 开始的坐标（`{ row, col }`）指定，没写工作表时指当前显示的那张。
- 写到别的表时，在名字前加 `表名!`，表名有空格时用单引号括起来；坐标写成 `{ sheet, row, col }`，`sheet` 是工作表的序号、`id` 或名字。
- 区域可以写 `'A1:C4'`、整列 `'B:D'`、整行 `'2:3'`。

行和列也可以按显示的写法指定，数字仍是从 0 开始的序号：

```ts
sheet.value.transact((tr) => {
  tr.insertRows('5:6') // 在第 5 行前插入两行，等同 insertRows(4, 2)
  tr.deleteCols('B:C')
  tr.moveRows('2:3', '8') // 第 2、3 行移到原来的第 8 行之前
  tr.moveCells('A1:B4', 'D1') // 像剪切粘贴一样移动一块单元格
  tr.fill('A2', 'A2:A20', { mode: 'series' })
})
```

## 公式引用

插入、删除和移动行列，以及移动单元格时，所有工作表里指向这些单元格的公式引用都随之改写：

- 插入行后 `=A5` 变成 `=A6`，区域 `A1:A5` 在中间插入一行后变成 `A1:A6`。
- 删除被引用的单元格后引用变成 `#REF!`，区域只删除一部分时缩小。
- 和复制不同，这时 `$A$1` 这样的固定引用也跟着改。

## 修改事件

每次修改，不论来自输入、撤销还是 `transact`，都会更新 `v-model` 并触发 `transaction` 事件。被保护或扩展取消的修改不会生效，触发的是 `transactionCancel` 事件。

事件参数里的 `steps` 是这次修改的步骤，`inverse` 是撤销它的步骤，可以用来同步到服务端。另一端用 `applySheetSteps(doc, steps)` 应用，在服务端从不含组件的 `@dou-ui/sheet/core` 引入它，见[不含组件的入口](./exporters#不含组件的入口)。步骤里的工作表用 `id` 记录，没有 `id` 时用名字，所以在另一端应用时不受工作表顺序影响。

`meta.action` 说明修改的来源：

| `action`                 | 来源                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `input`                  | 在单元格里输入                                                     |
| `paste`、`cut`           | 粘贴；粘贴剪切的内容（移动单元格）                                 |
| `fill`、`clear`          | 填充柄、`Ctrl` + `D` / `R`；清空内容                               |
| `resize`、`hide`、`move` | 调整行高列宽；隐藏、取消隐藏；移动行列                             |
| `merge`                  | 合并、取消合并单元格                                               |
| `group`                  | 分组、取消分组、折叠和展开分组                                     |
| `note`                   | 插入、编辑和删除批注                                               |
| `link`                   | 插入、编辑和删除链接                                               |
| `comment`                | 发起、删除讨论时写入或去掉单元格的 `comment`，见[评论](./comments) |
| `restore`                | 恢复到某个版本，见[历史版本](./versions)                           |
| `protect`                | 锁定单元格，保护工作表和工作簿结构                                 |
| `style`、`freeze`        | 工具栏或快捷键修改样式、数字格式；工具栏冻结行列                   |
| `sort`、`filter`         | 排序；开关筛选、修改筛选条件，见[筛选与排序](./filter)             |
| `format`                 | 添加、修改和删除条件格式，见[条件格式](./rules)                    |
| `validation`             | 添加、修改和删除数据验证，见[数据验证](./rules)                    |
| `sheet`                  | 标签栏里新建、重命名、复制、移动、删除工作表                       |
| `import`                 | 导入文件                                                           |
| `replace`                | 查找面板里的替换、全部替换                                         |
| `insert`、`delete`       | 插入、删除行列                                                     |
| `undo`、`redo`           | 撤销、重做                                                         |
| `api`                    | 组件实例的 `transact`，没有指定 `action`                           |

## 修改选项

`transact` 的第二个参数，也可以在事务里用 `tr.setMeta()` 设置：

- `action`：修改的来源，见上表。
- `history: false`：不进入撤销记录，也不检查保护，用于[协同编辑](./collaboration)里别人的修改。
- `group`：同一 `group` 的连续修改合并为一步撤销。
- `protection: false`：不检查保护，见[保护](./protect#用代码修改)。
- `origin`：自己的标记，比如在扩展的 `update` 里区分修改是谁做的。

## API

### 事务方法

各页列出了相关的方法：[行、列与合并](./rows#事务方法)、[批注与链接](./notes#事务方法)、[筛选、排序与查找](./filter#事务方法)、[条件格式与数据验证](./rules#事务方法)、[保护](./protect#事务方法)、[工具栏与工作表](./toolbar#事务方法)。下面是读写单元格的方法：

| 方法                                    | 说明                                                                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getCell(cell)`                         | 读取单元格，包括这次事务里已经做的修改                                                                                                                               |
| `setValue(cell, value)`                 | 写入值，保留样式和格式                                                                                                                                               |
| `updateCell(cell, patch)`               | 修改单元格的部分字段，值为 `undefined` 的字段会被删除                                                                                                                |
| `setCell(cell, input)`                  | 整个替换单元格，`undefined` 清空                                                                                                                                     |
| `setCells(cell, block)`                 | 以 `cell` 为左上角写入一块单元格（二维数组）                                                                                                                         |
| `clearValues(range)`                    | 清空一片区域的值，保留样式                                                                                                                                           |
| `moveCells(range, cell)`                | 把一块单元格移到以 `cell` 为左上角的位置，原位置清空                                                                                                                 |
| `fill(from, to, { mode?, keepStyle? })` | 用 `from` 的内容按填充柄的规则填满 `to`；`mode` 为 `auto`（默认）、`series`（一个数字也逐个加一）或 `copy`；`keepStyle` 为 `true` 时被填的单元格保留自己的样式和格式 |
| `setComment(cell, id)`                  | 把讨论放到单元格上，`undefined` 去掉，见[评论](./comments#用代码修改)                                                                                                |
| `cancel(reason?)`                       | 取消这次修改，在扩展的 `transaction` 里使用                                                                                                                          |
| `setMeta(meta)`                         | 设置修改选项                                                                                                                                                         |

### SheetTransaction

| 属性                        | 说明                                                 |
| --------------------------- | ---------------------------------------------------- |
| `steps`、`inverse`          | 这次修改的步骤、撤销它的步骤                         |
| `meta`                      | 修改选项，`meta.action` 是修改的来源                 |
| `changed`                   | 是否有改动                                           |
| `cancelled`、`cancelReason` | 是否被取消、取消的原因                               |
| `doc`                       | 修改后的工作簿                                       |
| `before`                    | 修改前的工作簿                                       |
| `sheet`                     | 没写工作表时，单元格和区域所在的工作表（序号或名称） |
