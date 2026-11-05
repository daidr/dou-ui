# CommentThread 评论讨论

一条讨论：发起的评论和后面的回复，可以回复、编辑和删除自己的评论、标记为已解决。适合放在文档、表格、任务旁边的评论区，[块编辑器的评论](/editor/comments)也用它显示。

## 基础用法

`v-model:thread` 绑定一条讨论，`author` 是当前用户。按 `Enter` 发送，`Shift+Enter` 换行；只有自己写的评论才有编辑和删除菜单。第一条评论右侧的对勾按钮把讨论标记为已解决，已解决的讨论不能再回复，可以重新打开。

<DocDemo src="comment-thread/basic" />

## 发起讨论

`thread` 为 `null` 时只显示输入框，发送后得到一条新的讨论。`placeholder` 只用于这个输入框，之后的回复框总是显示“回复”。

<DocDemo src="comment-thread/new" />

## 多条讨论与保存

每次修改都会触发 `action` 事件，参数描述这次修改了什么（`CommentAction`）。把它发给服务器，比每次保存整条讨论更省事；在别处用 `applyCommentAction` 应用同一个修改，就能得到一样的结果。

讨论本身没有边框，放在卡片、浮层或侧栏里使用。

<DocDemo src="comment-thread/list" />

## 数据格式

```ts
interface CommentThread {
  id: string
  /** 第一条是发起讨论的评论，后面是回复 */
  comments: CommentItem[]
  /** 已解决时记录是谁、在什么时候 */
  resolved?: { by: CommentAuthor; at: string }
}

interface CommentItem {
  id: string
  author: CommentAuthor
  /** 纯文本，保留换行 */
  body: string
  /** ISO 时间字符串 */
  createdAt: string
  /** 编辑过时的时间 */
  editedAt?: string
}

interface CommentAuthor {
  id: string
  name: string
  /** 头像地址，没有时显示名字的首字 */
  avatar?: string
}
```

作者的名字和头像随评论一起保存，一条讨论单独拿出来就能显示，不需要再查用户信息。

`CommentAction` 是下面几种之一：

| `type`    | 其他字段                                    | 说明                                                          |
| --------- | ------------------------------------------- | ------------------------------------------------------------- |
| `create`  | `thread`                                    | 发起讨论，`thread` 带着第一条评论                             |
| `reply`   | `threadId`、`comment`                       | 回复                                                          |
| `edit`    | `threadId`、`commentId`、`body`、`editedAt` | 编辑评论                                                      |
| `delete`  | `threadId`、`commentId`                     | 删除一条回复。第一条评论不单独删除，要连同讨论一起用 `remove` |
| `resolve` | `threadId`、`by`、`at`                      | 标记为已解决                                                  |
| `reopen`  | `threadId`                                  | 重新打开                                                      |
| `remove`  | `threadId`                                  | 删除整条讨论                                                  |

## API

### Props

| 名称          | 说明                                                                                   | 类型                    | 默认值  |
| ------------- | -------------------------------------------------------------------------------------- | ----------------------- | ------- |
| `thread`      | 讨论，支持 `v-model:thread`，不绑定时组件自己保存；`null` 时只显示发起讨论的输入框     | `CommentThread \| null` | `null`  |
| `author`      | 当前用户，只能编辑和删除自己的评论；不传时只能查看                                     | `CommentAuthor`         | —       |
| `readonly`    | 只显示评论，没有输入框、解决按钮和菜单                                                 | `boolean`               | `false` |
| `resolvable`  | 显示解决按钮；`false` 只隐藏这个按钮，回复框和菜单保留，适合没有“已解决”状态的草稿批注 | `boolean`               | `true`  |
| `placeholder` | 发起讨论时输入框的提示文字，默认为“写评论”；回复框不受影响                             | `string`                | —       |
| `autofocus`   | 挂载后聚焦输入框                                                                       | `boolean`               | `false` |

### Events

| 名称            | 说明                                       | 类型                                      |
| --------------- | ------------------------------------------ | ----------------------------------------- |
| `update:thread` | 修改后的讨论，删除整条讨论时为 `null`      | `(thread: CommentThread \| null) => void` |
| `action`        | 每次修改                                   | `(action: CommentAction) => void`         |
| `cancel`        | 在空输入框按 `Esc`，或点击新讨论的取消按钮 | `() => void`                              |

### Slots

| 名称     | 说明                                 |
| -------- | ------------------------------------ |
| `header` | 评论上方的内容，比如被评论的那段文字 |

### Exposes

| 名称    | 说明       | 类型         |
| ------- | ---------- | ------------ |
| `focus` | 聚焦输入框 | `() => void` |

### 工具函数

| 名称                       | 说明                                                                      | 类型                                                                       |
| -------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `applyCommentAction`       | 把一次修改应用到讨论列表，返回新的数组                                    | `(threads: CommentThread[], action: CommentAction) => CommentThread[]`     |
| `createCommentId`          | 生成随机 id                                                               | `() => string`                                                             |
| `applySharedCommentAction` | 把一次修改写进共享的 Yjs `Y.Map`，在一个事务里完成，`origin` 作为事务来源 | `(map: SharedCommentMap, action: CommentAction, origin?: unknown) => void` |
| `readSharedComments`       | 从共享的 `Y.Map` 读出全部讨论，讨论和回复按时间排序                       | `(map: SharedCommentMap) => CommentThread[]`                               |

后两个函数用于自己用 Yjs 同步讨论的场景（编辑器的 `collaboration({ comments })` 内部用的就是它们）。`SharedCommentMap` 是 `Y.Map` 的结构类型，直接传入 `Y.Map` 即可，`dou-ui` 不依赖 yjs。map 里每条讨论存为 `t:<讨论 id>`，每条评论存为 `c:<评论 id>`，两个人同时回复不会互相覆盖。这个 map 应只用来保存讨论。
