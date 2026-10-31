# 协同编辑

`@dou-ui/sheet/collaboration` 让多人同时编辑同一个工作簿。工作簿保存在 [Yjs](https://yjs.dev) 的共享文档里，各端的修改会自动合并，断网期间的修改在重新连接后也会合并。

## 安装

协同编辑依赖 Yjs，需要另外安装：

```sh
bun add yjs
```

## 基础用法

把 `collaboration` 扩展加到表格的 `extensions` 里，传入共享文档中的一个 `Y.Map`：

```vue
<script setup lang="ts">
import { DouSheet, type SheetWorkbook } from '@dou-ui/sheet'
import { collaboration } from '@dou-ui/sheet/collaboration'
import { ref } from 'vue'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://example.com', 'budget-2026', doc)

const book = ref<SheetWorkbook>({ sheets: [{ name: '表 1', cells: [] }] })
const extensions = [
  collaboration({
    book: doc.getMap('book'),
    awareness: provider.awareness,
    user: { name: '戴兜' },
  }),
]
</script>

<template>
  <DouSheet v-model="book" :extensions="extensions" />
</template>
```

`collaboration()` 要在 `<script setup>` 里创建一次，不要直接写在模板的 `:extensions` 里。写在模板里时每次渲染都会得到一个新的扩展，表格会重新初始化它，撤销记录也会被清空。

表格不负责网络传输。各端之间怎么同步共享文档由 Yjs 的 provider 决定，例如 `y-websocket`、`y-webrtc`，也可以自己实现。

下面的示例在同一个页面里放了两个表格，代表两个人。一边选中的区域，另一边会用对方的颜色标出来，选中的单元格旁边显示名字，正在编辑时名字前有一支笔。断开连接后分别插入、删除行或修改单元格，再重新连接，两边的修改会合并到一起。

<DocDemo src="sheet/collaboration" column />

## 文档数据

使用协同编辑时，共享文档是唯一的数据来源：

- 表格从共享文档读取工作簿，不读取 `v-model` 的初始值。共享文档还是空的时候例外，这时会把 `v-model` 里的工作簿写进去。
- `v-model` 仍然会在每次修改后更新，包括其他人的修改，可以用来保存快照。从外部修改 `v-model` 不会写回共享文档，要修改请用 `transact`。
- 每个工作表都需要 `id`，这样改名后其他人也能找到它。没有 `id` 的工作表会自动得到一个。
- 只读的表格也会显示其他人的修改。

已有的工作簿开始协同编辑时，也可以用 `fillBook` 把它写入空的共享文档：

```ts
import { fillBook } from '@dou-ui/sheet/collaboration'

fillBook(doc.getMap('book'), workbook)
```

这一步通常在创建共享文档时在服务器上做一次。`readBook` 反过来从共享文档读出工作簿，例如在服务器上保存快照或导出 CSV。

## 撤销

协同编辑时，撤销和重做只针对当前用户自己的修改，不会撤销其他人的修改，撤销后会回到修改前的工作表和选区。`collaboration` 扩展会替换表格自带的撤销记录。

## 同时修改时的结果

共享文档里的每一行、每一列都有自己的 id。单元格、行高列宽、合并单元格、筛选、条件格式和数据验证都按行列的 id 保存，公式里的引用也一样。所以：

- 一个人在上面插入或删除行，另一个人同时在下面修改单元格，修改会落在原来那一格，不会错位。
- 公式和规则在其他人插入、删除、移动行列之后，仍然指向写下时的那些单元格。例如别人在 `合计` 上方插入一行，另一个人同时写的 `=B5*2` 会跟着变成 `=B6*2`。
- 一个人删除了某一行，另一个人同时写了引用这一行的公式，这个引用会变成 `#REF!`，和删除行之后再写公式的结果一样。
- 两个人同时修改同一个单元格，以后到的为准。单元格的值、样式、格式作为整体保存。
- 两个人同时把同一行移到不同的位置，各端最后都只有一行，位置相同。
- 一个人给工作表改了名，其他人的公式里引用这个工作表的地方会跟着改名。

正在编辑的单元格和选区也会跟着其他人插入、删除的行列移动；正在编辑的单元格被别人删掉时，编辑会结束。

## API

### collaboration 选项

| 名称        | 说明                                                                                     | 类型                |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------- |
| `book`      | 保存工作簿的共享 `Y.Map`                                                                 | `Y.Map`             |
| `awareness` | 用于同步选区和正在编辑的单元格（`y-protocols` 的 `Awareness`），不传时不显示其他人在哪里 | `Awareness`         |
| `user`      | 当前用户，显示在其他人看到的标记上                                                       | `CollaborationUser` |

```ts
interface CollaborationUser {
  name: string
  /** 标记的颜色，任意 CSS 颜色；不传时按 Yjs 的 clientID 从 collaborationColors 里选 */
  color?: string
}
```

每个人在 awareness 的 `sheet` 字段里分享自己打开的工作表、选区和是否在编辑，行列用 id 表示，可以用来在表格外显示在线的人：

```ts
interface SheetPresence {
  /** 打开的工作表的 id */
  sheet: string
  /** 当前单元格 [行, 列] */
  active: [string | number, string | number]
  /** 选区，每个是 [上, 左, 下, 右] */
  ranges: [string | number, string | number, string | number, string | number][]
  editing: boolean
}
```

### 函数和常量

| 名称                  | 说明                           | 类型                                             |
| --------------------- | ------------------------------ | ------------------------------------------------ |
| `fillBook`            | 把工作簿写入空的共享文档       | `(book: Y.Map, workbook: SheetWorkbook) => void` |
| `readBook`            | 从共享文档读出工作簿           | `(book: Y.Map) => SheetWorkbook`                 |
| `collaborationColors` | 不传 `user.color` 时使用的颜色 | `string[]`                                       |
