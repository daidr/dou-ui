# 评论

给 `DouEditor` 传入 `v-model:comments`，就可以对文档里的文字发起讨论。选中文字后，点击格式工具栏上的评论按钮（或按 `Ctrl/⌘+Alt+M`），在旁边写下第一条评论；被评论的文字会高亮，点击高亮的文字打开讨论，可以回复、编辑、删除和标记为已解决。用键盘时，把光标移到高亮的文字里按 `Ctrl/⌘+Alt+M` 打开讨论，焦点会落在回复框里；按 `Esc` 关闭讨论回到正文。

<DocDemo src="editor/comments" column />

```vue
<script setup lang="ts">
import { DouEditor } from '@dou-ui/editor'
import type { CommentThread } from 'dou-ui'
import { ref } from 'vue'

const doc = ref({ version: 1, blocks: [] })
const threads = ref<CommentThread[]>([])
const active = ref<string | null>(null)
</script>

<template>
  <DouEditor
    v-model="doc"
    v-model:comments="threads"
    v-model:active-comment="active"
    :author="{ id: 'dai', name: '戴兜' }"
  />
</template>
```

不传 `comments` 时没有评论功能。不传 `author` 时可以查看讨论，但不能发起和回复。

## 数据怎么保存

一条讨论分成两部分，分开保存：

- **被评论的文字**保存在文档里：文字片段的 `comments` 字段记录它属于哪些讨论。前面插入了文字、块被移动或拆分时，评论跟着文字走。
- **讨论的内容**（评论、回复、是否已解决）保存在 `v-model:comments` 里，格式见 [CommentThread](/components/comment-thread#数据格式)。

```ts
// 文档里的一段文字
{ type: 'text', text: '全场八折', comments: ['price'] }

// v-model:comments 里的一条讨论
{ id: 'price', comments: [{ id: 'p1', author: { id: 'qing', name: '阿青' }, body: '八折和会员价能叠加吗？', createdAt: '…' }] }
```

同一段文字可以属于几条讨论，重叠的部分颜色更深。已解决的讨论不再高亮，但仍然在 `comments` 里，可以在侧栏里重新打开。

评论不进撤销记录：按 `Ctrl/⌘+Z` 撤销的是正文的修改，不会撤掉刚发出的评论或它的高亮。

### 复制和剪切

复制一段被评论的文字粘贴到别处，讨论不会跟过去，仍然只在原来的文字上。剪切再粘贴时原来的文字已经不在，讨论跟着文字移到新的位置。从别的文档粘贴来的、`comments` 里没有的讨论会被去掉。

导出 HTML 和 Markdown 时不包含评论。

### 原文被删除的讨论

被评论的文字整个删掉后，讨论仍然留在 `comments` 里，撤销删除时高亮会回来。用 `getCommentAnchors()` 可以查到每条讨论现在的位置，原文已删除的讨论返回 `null`，可以在侧栏里单独显示，或者自行清理。删除整条讨论时，文字上的高亮会一起去掉。

## 和侧栏联动

`v-model:activeComment` 是当前打开的讨论。点击正文里高亮的文字会更新它；在侧栏里设置它，正文里会打开这条讨论。上面的示例用它做了一个评论列表，被评论的文字通过 `getCommentAnchors()` 读取。

## 保存到服务器

每次修改评论都会触发 `commentAction` 事件，参数是这次修改（`CommentAction`，见 [CommentThread](/components/comment-thread#数据格式)），比如“回复了某条讨论”。可以直接发给服务器，也可以用来通知被回复的人。

```vue
<DouEditor
  v-model="doc"
  v-model:comments="threads"
  :author="me"
  @comment-action="(action) => api.post('/comments', action)"
/>
```

注意：发起讨论时文档也会改变（文字加上了 `comments`），所以正文也需要保存。

## 只读时评论

`readonly` 时正文不能修改，仍然可以选中文字发起讨论，适合审阅。`commentable` 设为 `false` 时只能查看讨论。

<DocDemo src="editor/comments-review" />

## 协同编辑

使用[协同编辑](./collaboration)时，把讨论也放进共享文档，所有人实时看到新的评论：

```ts
collaboration({
  map: doc.getMap('document'),
  comments: doc.getMap('comments'),
  awareness,
  user,
})
```

这时 `v-model:comments` 只反映共享文档里的讨论，从外部修改不会写回。两个人同时回复、编辑或标记已解决，都会保留下来。不传 `comments` 时，被评论的文字照样随文档同步，讨论由应用自己同步。

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

### Exposes

| 名称                | 说明                                                                                                                                | 类型                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `comment`           | 对选中的文字发起讨论，打开输入框；光标在被评论的文字里时打开那条讨论；都不是时返回 `false`                                          | `() => boolean`                               |
| `getCommentAnchors` | 每条讨论所在的位置，原文已删除的为 `null`。返回值不是响应式的，在 `change`（包括协同时别人的修改）和 `update:comments` 之后重新读取 | `() => Record<string, CommentAnchor \| null>` |

```ts
interface CommentAnchor {
  /** 所在块的 id（跨块时为第一个块） */
  block: string
  /** 被评论的文字 */
  text: string
  /** 在 ProseMirror 文档里的起止位置 */
  from: number
  to: number
}
```

### CSS 变量

| 变量                             | 说明                   |
| -------------------------------- | ---------------------- |
| `--dou-editor-comment-bg`        | 被评论文字的背景       |
| `--dou-editor-comment-bg-active` | 打开的讨论的文字背景   |
| `--dou-editor-comment-line`      | 被评论文字的下划线颜色 |
