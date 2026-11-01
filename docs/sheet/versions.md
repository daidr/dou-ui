# 历史版本

`DouSheet` 不保存版本列表：一个版本就是某一刻的工作簿（`v-model` 的值），存在哪里、怎么命名由应用决定。表格提供三件事：对比两个版本、在改过的单元格之间跳转、恢复到某个版本。

<DocDemo src="sheet/versions" column />

## 保存版本

不协同时，`v-model` 的值就是当前工作簿，直接存下来：

```ts
const versions = ref<{ id: string; name: string; createdAt: string; book: SheetWorkbook }[]>([])

function saveVersion(name: string) {
  versions.value.push({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    book: structuredClone(toRaw(book.value)),
  })
}
```

版本是普通的 JSON，可以存进数据库，也可以在服务端读取。协同编辑时，在没有表格的地方（比如服务端定时保存）用 `readBook` 从共享文档读出当前工作簿：

```ts
import { readBook } from '@dou-ui/sheet/collaboration'

const book = readBook(ydoc.getMap('book'))
```

## 对比

把旧版本传给 `compare`，表格变成只读，标出和旧版本相比改过的单元格：

```vue
<DouSheet v-model="book" :compare="version.book" />
```

- 改过的单元格底色变黄，下边有一条黄线。值、公式、样式、格式和类型的修改都算。
- 鼠标停在改过的单元格上，提示里显示它原来的内容；原来是空的显示“原来为空”。读屏读单元格时也会读出原来的内容。
- 工作表按 `id`（没有时按名字）对应，单元格按位置对应。插入或删除过行列时，后面的单元格会整片标出。
- 讨论不算修改。同一个单元格的不同写法（`1` 和 `{ value: 1 }`、空文字和空单元格）不算修改。
- 工作表的保护、命名样式（比如解锁单元格的样式）和工作簿的设置不画在单元格上，用 `diffWorkbooks` 查看。

`nextChange()` 和 `previousChange()` 依次选中下一个、上一个改过的单元格，会切换到别的工作表，没有更多时返回 `false`，可以接在自己的按钮上。`compare` 设为 `null` 回到编辑。

只想知道改了多少，不需要显示时，用 `diffWorkbooks`：

```ts
import { diffWorkbooks } from '@dou-ui/sheet'

const { cells, addedSheets, removedSheets, changedSheets, changedStyles, bookChanged } =
  diffWorkbooks(version.book, book.value)
// 版本列表里显示“改了 12 个单元格，新增 1 个工作表”
```

`cells` 按工作表、行、列的顺序列出每个改过的单元格和它前后的内容。工作表的名字、行高列宽、合并、筛选、条件格式、保护等设置变了时，这个工作表出现在 `changedSheets` 里；`changedStyles`、`changedTypes` 是改过的命名样式和单元格类型，工作簿自己的设置（比如保护工作簿结构）变了时 `bookChanged` 为 `true`。

## 恢复

`restore(book)` 把工作簿换成某个版本，算一次修改，可以撤销。只写入有差异的部分：多出的工作表删掉、少了的加回来、顺序调回去，再写入改过的单元格和设置。协同编辑时只把这些写进共享文档，别人正在修改的其他单元格不受影响。没有差异时返回 `false`。和 `transact` 一样，`readonly` 不限制代码里的调用；对比时（传了 `compare`）表格不能修改，`transact`、`undo`、`redo` 都不生效，`restore` 是唯一能用的修改。

恢复和撤销一样不受[保护](./#保护)的限制：版本里的保护设置、锁定和解锁的样式都会恢复，受保护工作表上锁定的单元格也会写回版本里的内容。扩展的 `transaction` 仍然会收到这次修改（`meta.action` 为 `restore`），可以[取消](./extensions#取消修改)它，这时返回 `false`。

恢复前表格不会自动保存版本。想让用户能回到恢复前的样子，在调用前先存一份：

```ts
function restore(version: Version) {
  saveVersion('恢复前')
  sheet.value?.restore(version.book)
}
```

讨论留在现在的单元格上：版本里存下的 `comment` 不会写回来。

用 `transact` 时，`restoreWorkbook(tr, book)` 把同样的修改加进事务，可以和其他修改合成一步。

## API

### Props

| 名称      | 说明                                                       | 类型                    | 默认值 |
| --------- | ---------------------------------------------------------- | ----------------------- | ------ |
| `compare` | 要对比的旧版本；传入时表格只读，并标出和它相比改过的单元格 | `SheetWorkbook \| null` | —      |

### 实例方法

| 名称             | 说明                                                       | 类型                               |
| ---------------- | ---------------------------------------------------------- | ---------------------------------- |
| `restore`        | 换成某个版本，可以撤销；没有差异或被扩展取消时返回 `false` | `(book: SheetWorkbook) => boolean` |
| `nextChange`     | 对比时选中下一个改过的单元格，没有更多时返回 `false`       | `() => boolean`                    |
| `previousChange` | 对比时选中上一个改过的单元格                               | `() => boolean`                    |

### 工具函数

| 名称              | 说明                                                            | 类型                                                              |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `diffWorkbooks`   | 两个版本之间改过的单元格和工作表                                | `(before: SheetWorkbook, after: SheetWorkbook) => WorkbookDiff`   |
| `restoreWorkbook` | 把恢复到 `book` 的修改加进事务                                  | `(tr: SheetTransaction, book: SheetWorkbook) => SheetTransaction` |
| `readBook`        | 从共享文档读出当前工作簿，从 `@dou-ui/sheet/collaboration` 引入 | `(map: Y.Map) => SheetWorkbook`                                   |

```ts
interface SheetCellChange {
  /** 工作表的 id（没有时为名字） */
  sheet: string
  row: number
  col: number
  /** 单元格地址，如 B3 */
  address: string
  before: SheetCellInput
  after: SheetCellInput
}

interface WorkbookDiff {
  cells: SheetCellChange[]
  /** 只有新版本有的工作表 */
  addedSheets: string[]
  /** 只有旧版本有的工作表 */
  removedSheets: string[]
  /** 名字、行高列宽、合并等设置变了的工作表 */
  changedSheets: string[]
  /** 改过的命名样式 */
  changedStyles: string[]
  /** 改过的单元格类型 */
  changedTypes: string[]
  /** 工作簿自己的设置（如 protect）是否改过 */
  bookChanged: boolean
}
```
