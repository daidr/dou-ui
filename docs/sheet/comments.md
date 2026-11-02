# 评论

给 `DouSheet` 传入 `v-model:comments`，就可以对单元格发起讨论。右键单元格选择“添加评论”（或按 `Ctrl/⌘+Alt+M`），在单元格旁边写下第一条评论；有讨论的单元格右上角有一个强调色的小三角，点击单元格打开讨论，可以回复、编辑、删除和标记为已解决。用键盘时，移到单元格上按 `Ctrl/⌘+Alt+M` 打开讨论，焦点会落在回复框里；按 `Esc` 关闭讨论回到表格。回复框里有没发出的文字时，第一次按 `Esc` 先清空文字，以免误关丢掉，再按一次才关闭。

<DocDemo src="sheet/comments" column />

```vue
<script setup lang="ts">
import { DouSheet, type SheetWorkbook } from '@dou-ui/sheet'
import type { CommentThread } from 'dou-ui'
import { ref } from 'vue'

const book = ref<SheetWorkbook>({ sheets: [{ name: '活动预算', cells: [] }] })
const threads = ref<CommentThread[]>([])
const active = ref<string | null>(null)
</script>

<template>
  <DouSheet
    v-model="book"
    v-model:comments="threads"
    v-model:active-comment="active"
    :author="{ id: 'dai', name: '戴兜' }"
  />
</template>
```

不传 `comments` 时没有评论功能。不传 `author` 时可以查看讨论，但不能发起和回复。

评论和[批注](./notes#批注)不同：批注是单元格自带的一段说明，谁都可以改；评论是几个人之间的讨论，有作者、时间和回复，可以标记为已解决。两者可以同时存在，有批注时评论的小三角在批注的下面。

## 数据怎么保存

一条讨论分成两部分，分开保存：

- **讨论在哪个单元格**保存在工作簿里：单元格的 `comment` 字段是讨论的 id，一个单元格只有一条讨论。插入、删除、移动行列和排序时，讨论跟着单元格走。合并单元格的讨论在它左上角的单元格上。
- **讨论的内容**（评论、回复、是否已解决）保存在 `v-model:comments` 里，格式见 [CommentThread](/components/comment-thread#数据格式)。

```ts
// 工作簿里的一个单元格
{ value: 48000, format: '¥#,##0', comment: 'venue' }

// v-model:comments 里的一条讨论
{ id: 'venue', comments: [{ id: 'v1', author: { id: 'qing', name: '阿青' }, body: '场地费含税吗？', createdAt: '…' }] }
```

已解决的讨论不再显示小三角，但仍然在 `comments` 里。在侧栏里把 `activeComment` 设为它的 id，卡片会在单元格旁打开，点“重新打开”就恢复了；上面的示例勾选“显示已解决”可以试试。

评论不进撤销记录：按 `Ctrl/⌘+Z` 撤销的是单元格的修改，不会撤掉刚发出的评论，撤销单元格的值时讨论也留在原处。

### 复制、剪切和填充

- 复制带讨论的单元格粘贴到别处，讨论不会跟过去，仍然只在原来的单元格上；粘贴到已有讨论的单元格时，那里的讨论保留。
- 剪切再粘贴时讨论跟着单元格移到新的位置。
- 填充不会复制讨论，被填充的单元格保留自己原来的讨论。
- 清除内容（`Delete`）不会删除讨论。

CSV、导出的图片和打印里不包含评论。

### 单元格被删除的讨论

带讨论的行或列被删除后，讨论仍然留在 `comments` 里，撤销删除时会回到原来的单元格。用 `getCommentAnchors()` 可以查到每条讨论现在所在的单元格，单元格已删除的讨论返回 `null`，可以在侧栏里单独显示，或者自行清理。在卡片里删除整条讨论时，单元格上的 `comment` 会一起去掉。用代码从 `comments` 里删掉讨论时，单元格上的 `comment` 还在，但不再显示，`getCommentAnchors()` 也不再返回它；需要清理时用 `tr.setComment(cell, undefined)`。

## 和侧栏联动

`v-model:activeComment` 是当前打开的讨论。点击带讨论的单元格会更新它；在侧栏里设置它，表格会切到讨论所在的工作表，滚动到单元格并打开讨论。上面的示例用它做了一个评论列表，讨论所在的单元格通过 `getCommentAnchors()` 读取。

## 保存到服务器

每次修改评论都会触发 `commentAction` 事件，参数是这次修改（`CommentAction`，见 [CommentThread](/components/comment-thread#数据格式)），比如“回复了某条讨论”。可以直接发给服务器，也可以用来通知被回复的人。

```vue
<DouSheet
  v-model="book"
  v-model:comments="threads"
  :author="me"
  @comment-action="(action) => api.post('/comments', action)"
/>
```

注意：发起讨论时工作簿也会改变（单元格加上了 `comment`），所以工作簿也需要保存。

## 只读时评论

`readonly` 时单元格不能修改，仍然可以发起和回复讨论，适合审阅。[保护](./protect)的工作表也一样，锁定的单元格也可以评论。`commentable` 设为 `false` 时只能查看讨论。

## 用代码修改

`tr.setComment(cell, id)` 把讨论放到单元格上，传 `undefined` 去掉，讨论的内容要自己加进 `comments`。传入 `{ history: false }` 时和表格里发起的讨论一样不进撤销记录：

```ts
sheet.value.transact((tr) => tr.setComment('B2', 'venue'), { history: false })
```

组件实例的 `comment(cell?)` 选中单元格并打开讨论，没有讨论时打开输入框，可以接在自己的按钮上。

## 协同编辑

使用[协同编辑](./collaboration)时，把讨论也放进共享文档，所有人实时看到新的评论：

```ts
collaboration({
  book: doc.getMap('book'),
  comments: doc.getMap('comments'),
  awareness,
  user,
})
```

这时 `v-model:comments` 只反映共享文档里的讨论，从外部修改不会写回。两个人同时回复、编辑或标记已解决，都会保留下来。不传 `comments` 时，单元格上的 `comment` 照样随工作簿同步，讨论由应用自己同步。

讨论所在的单元格单独保存，别人撤销自己对这个单元格的修改时，讨论不会被撤掉。

## API

### Props

| 名称            | 说明                                                                                                       | 类型              | 默认值 |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ----------------- | ------ |
| `comments`      | 所有讨论，支持 `v-model:comments`；不传时没有评论功能（用 `collaboration({ comments })` 共享讨论时不用传） | `CommentThread[]` | —      |
| `author`        | 当前用户；不传时只能查看讨论                                                                               | `CommentAuthor`   | —      |
| `activeComment` | 打开的讨论，支持 `v-model:activeComment`                                                                   | `string \| null`  | —      |
| `commentable`   | 能否发起和回复讨论，`readonly` 时同样有效                                                                  | `boolean`         | `true` |

### Events

| 名称                   | 说明               | 类型                                 |
| ---------------------- | ------------------ | ------------------------------------ |
| `update:comments`      | 讨论变化           | `(threads: CommentThread[]) => void` |
| `update:activeComment` | 打开的讨论变化     | `(id: string \| null) => void`       |
| `commentAction`        | 在这里做的一次修改 | `(action: CommentAction) => void`    |

### 实例方法

| 名称                | 说明                                                                                                                                    | 类型                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `comment`           | 打开单元格（默认是当前单元格）上的讨论，没有讨论时打开输入框；没有评论功能或不能发起时返回 `false`                                      | `(cell?: SheetCellTarget) => boolean`              |
| `getCommentAnchors` | 每条讨论所在的单元格，单元格已删除的为 `null`。返回值不是响应式的，在 `change`（包括协同时别人的修改）和 `update:comments` 之后重新读取 | `() => Record<string, SheetCommentAnchor \| null>` |

```ts
interface SheetCommentAnchor {
  /** 工作表的 id（没有时为名字） */
  sheet: string
  row: number
  col: number
  /** 单元格地址，如 B3 */
  address: string
}
```

### 函数

| 名称                        | 说明                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `sheetCommentAnchors(book)` | 读出工作簿里每条讨论所在的单元格，返回 `Map<string, SheetCommentAnchor>`，可以在服务端用 |
