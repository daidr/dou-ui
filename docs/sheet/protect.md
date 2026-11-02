# 保护

保护工作表后，其中锁定的单元格不能修改；保护工作簿结构后，工作表不能添加、删除、移动或重命名。适合只让人填几个空的表单，或者防止误改公式和标题。

## 基础用法

单元格默认是锁定的，所以给需要填写的单元格一个 `locked: false` 的样式，再把工作表的 `protect` 设为 `true`：

```ts
const book = {
  version: 1,
  styles: { blank: { locked: false } },
  sheets: [
    {
      name: '报价单',
      protect: true,
      cells: [
        [
          { value: '客户', style: 'head' },
          { value: '戴兜', style: 'blank' },
        ],
      ],
    },
  ],
}
```

<DocDemo src="sheet/protect" column />

- 不允许的修改不会生效，表格下方提示原因，比如“单元格受保护，不能修改”，读屏也会读出。
- 受保护的工作表在标签上显示一个锁。
- 粘贴和填充只写入单元格的值，保留目标单元格原有的样式和格式，所以不会把未锁定的单元格变成锁定的。
- 撤销和重做不受保护的限制。

## 保护选项

工作表受保护时，行列也不能插入、删除或调整大小。`protect` 写成对象时可以放开其中几项，比如 `{ formatColumns: true, insertRows: true }` 允许调整列宽和插入行，可用的选项见[文档数据 · 工作表](./data#工作表)。

工作簿的 `protect: true` 保护工作簿结构。

## 在界面上操作

- 工具栏的“保护”菜单可以锁定或取消锁定所选单元格、保护或取消保护工作表、保护或取消保护工作簿结构。
- 单元格的右键菜单可以锁定和取消锁定，工作表标签的右键菜单可以保护工作表和工作簿结构。
- 锁定和解锁单元格要在保护工作表之前做。

保护只防止在表格里误改，没有密码。需要真正限制修改时，应该在保存数据的地方检查权限。

## 不允许取消保护

不想让人在表格里取消保护时，用扩展把两个保护命令换成不可用的，工具栏、单元格和标签的右键菜单里对应的项都会变灰。也可以在工具栏的 `tools` 里去掉 `protect`。

```ts
import { defineSheetCommand, defineSheetExtension } from '@dou-ui/sheet'

const fixedProtection = defineSheetExtension({
  name: 'fixed-protection',
  commands: {
    'protect.sheet': defineSheetCommand({
      label: (m) => m.protect.unprotectSheet,
      override: true,
      enabled: () => false,
      run: () => false,
    }),
    'protect.workbook': defineSheetCommand({
      label: (m) => m.protect.unprotectBook,
      override: true,
      enabled: () => false,
      run: () => false,
    }),
  },
})
```

## 用代码修改

代码的修改同样要遵守保护。需要绕过时，比如程序填写受保护的表单，传 `{ protection: false }`：

```ts
sheet.value.transact((tr) => tr.setValue('A1', '买家'), { protection: false })
```

`history: false` 的修改（撤销重做、[协同编辑](./collaboration)里别人的修改）不能取消，同样不检查保护。不要用它来绕过保护，要绕过就写 `protection: false`。

在 `transactionCancel` 事件里调用 `checkProtection(tr)`，可以分清修改是被保护还是被扩展取消的，以及卡在哪个单元格。

## API

### 事务方法

| 方法                            | 说明                                            |
| ------------------------------- | ----------------------------------------------- |
| `protectSheet(protect, sheet?)` | 保护工作表：`true` 或选项对象，`false` 取消保护 |
| `updateBook({ protect })`       | 保护或取消保护工作簿结构                        |
| `styleCells(range, { locked })` | 锁定或解锁单元格                                |

### 函数

| 名称                   | 说明                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `checkProtection(tr)`  | 检查一次修改是否违反保护，返回第一个不允许的地方 `{ reason, sheet, row, col }`，没有时为 `null` |
| `isLocked(cell, book)` | `cells` 里的一个单元格是否锁定                                                                  |
| `protectionOf(sheet)`  | 工作表的保护选项；没有保护时为 `null`，保护为 `true` 时为 `{}`                                  |
