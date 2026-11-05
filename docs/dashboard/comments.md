# 评论

给 `DouDashboard` 传入 `v-model:comments`，就可以对格子发起讨论，适合审阅一份报表：在“今日订单”上问“为什么比昨天少”，在趋势图上问“这个高点是怎么来的”。

<DocDemo src="dashboard/comments" column />

```vue
<script setup lang="ts">
import { DouDashboard, type DashboardDocument } from '@dou-ui/dashboard'
import type { CommentThread } from 'dou-ui'
import { ref } from 'vue'

const doc = ref<DashboardDocument>({ version: 1, widgets: [] })
const threads = ref<CommentThread[]>([])
const active = ref<string | null>(null)
</script>

<template>
  <DouDashboard
    v-model="doc"
    v-model:comments="threads"
    v-model:active-comment="active"
    :widgets="widgets"
    :author="{ id: 'dai', name: '戴兜' }"
  />
</template>
```

不传 `comments` 时没有评论功能。不传 `author` 时可以查看讨论，但不能发起和回复。

## 发起和查看

- 每个格子的标题栏上有一个评论按钮，点击打开讨论；没有讨论时打开输入框，发起一条。
- 只用键盘时，焦点在格子里时按 `Ctrl/⌘` + `Alt` + `M`。用键盘打开时焦点直接落在回复框里；用鼠标或手指点开时只显示讨论，不会在手机上弹出键盘，点回复框再回复。
- 有讨论的格子，评论按钮上显示条数，不用把鼠标移上去也能看到。一个格子有几条讨论时，卡片里依次列出，可以回复、编辑、删除和标记为已解决。
- 已经有讨论的格子再点评论按钮，会打开已有的讨论，不会再发起一条。
- 再点一次评论按钮或按 `Esc` 关闭卡片，焦点回到评论按钮上；回复框里有没发出的文字时，第一次按 `Esc` 先清空文字。
- 不能发起讨论时（没有 `author`，或 `commentable` 为 `false`），没有讨论的格子不显示评论按钮。

讨论只能放在整个格子上，还不能放在图表的某个数据点上。

## 数据怎么保存

一条讨论分成两部分，分开保存：

- **讨论在哪里**保存在仪表盘文档里：格子的 `comments` 字段是讨论 id 的数组。移动、缩放格子，讨论都跟着走。
- **讨论的内容**（评论、回复、是否已解决）保存在 `v-model:comments` 里，格式见 [CommentThread](/components/comment-thread#数据格式)。

```ts
// 仪表盘文档里的一个格子
{ id: 'orders', type: 'stat', title: '今日订单', props: { value: 1326 }, place: { lg: { x: 4, y: 0, w: 4, h: 2 } }, comments: ['orders-drop'] }

// v-model:comments 里的一条讨论
{ id: 'orders-drop', comments: [{ id: 'o1', author: { id: 'qing', name: '阿青' }, body: '上海仓今天订单少了一成，是不是系统问题？', createdAt: '…' }] }
```

已解决的讨论不再计入按钮上的条数，但仍然在 `comments` 里。把 `activeComment` 设为它的 id，卡片会在原来的格子上打开，点“重新打开”就恢复了；上面的示例勾选“显示已解决”可以试试。

评论不进撤销记录：按 `Ctrl/⌘` + `Z` 撤销的是仪表盘的修改，不会撤掉刚发出的评论；撤销添加格子再重做时，格子上的讨论也一起回来。发起和删除讨论时修改文档的事务带有 `meta.origin: 'comment'`，在 `change` 事件里可以据此区分。

### 复制和删除

- 复制、粘贴或“复制一份”得到的格子不带讨论，讨论仍然只在原来的格子上。
- 删除带讨论的格子后，讨论仍然留在 `comments` 里，撤销删除时会回到原处。用 `getCommentAnchors()` 可以查到每条讨论现在在哪个格子上，格子已删除的返回 `null`，可以在侧栏里单独显示，或者自行清理。把 `activeComment` 设为这样一条讨论的 id 时不会打开卡片，示例里把它们显示为不可点击。
- 在卡片里删除整条讨论时，格子上的 id 会一起去掉。用代码从 `comments` 里删掉讨论时，id 还在，但不再显示；需要清理时用 [`transaction`](./document#修改文档) 修改格子的 `comments`。

导出的图片里不包含评论按钮和卡片。

## 和侧栏联动

`v-model:activeComment` 是当前打开的讨论。点击评论按钮会更新它；在侧栏里设置它，仪表盘会把讨论所在的格子滚动到视野里并打开讨论。上面的示例用它做了一个评论列表，讨论所在的格子通过 `getCommentAnchors()` 读取。

## 保存到服务器

每次修改评论都会触发 `commentAction` 事件，参数是这次修改（`CommentAction`，见 [CommentThread](/components/comment-thread#数据格式)），可以直接发给服务器，也可以用来通知被回复的人。

```vue
<DouDashboard
  v-model="doc"
  v-model:comments="threads"
  :widgets="widgets"
  :author="me"
  @comment-action="(action) => api.post('/comments', action)"
/>
```

注意：发起讨论时仪表盘文档也会改变（格子加上了 `comments`），所以文档也需要保存。

## 不能编辑时评论

`editable` 为 `false` 时不能修改仪表盘，仍然可以发起和回复讨论，适合把报表发给别人审阅。`commentable` 设为 `false` 时只能查看讨论。

## 协同编辑

使用[协同编辑](./collaboration)时，格子上的 `comments` 和其他字段一样随共享文档同步。讨论的内容不在共享文档里，由应用自己同步，例如收到 `commentAction` 后发给服务器，再把其他人的修改写回 `v-model:comments`。

两个人几乎同时在同一个格子上发起讨论时，格子的 `comments` 以后写入的为准，先发起的那条讨论仍在 `comments` 里，但不再挂在格子上；可以用 `getCommentAnchors()` 找出这样的讨论，重新写回格子。

## API

### Props

| 名称            | 说明                                                  | 类型              | 默认值 |
| --------------- | ----------------------------------------------------- | ----------------- | ------ |
| `comments`      | 所有讨论，支持 `v-model:comments`；不传时没有评论功能 | `CommentThread[]` | —      |
| `author`        | 当前用户；不传时只能查看讨论                          | `CommentAuthor`   | —      |
| `activeComment` | 打开的讨论，支持 `v-model:activeComment`              | `string \| null`  | —      |
| `commentable`   | 能否发起和回复讨论，不能编辑时同样有效                | `boolean`         | `true` |

### Events

| 名称                   | 说明               | 类型                                 |
| ---------------------- | ------------------ | ------------------------------------ |
| `update:comments`      | 讨论变化           | `(threads: CommentThread[]) => void` |
| `update:activeComment` | 打开的讨论变化     | `(id: string \| null) => void`       |
| `commentAction`        | 在这里做的一次修改 | `(action: CommentAction) => void`    |

### Exposes

| 名称                | 说明                                                                                                                                           | 类型                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `comment`           | 打开格子上的讨论并聚焦回复框，没有讨论时打开输入框；不传 `id` 时用焦点所在的格子。格子不存在、没有评论功能，或没有讨论又不能发起时返回 `false` | `(id?: string) => boolean`                             |
| `getCommentAnchors` | 每条讨论所在的格子，格子已删除的为 `null`。返回值不是响应式的，在 `update:modelValue` 和 `update:comments` 之后重新读取                        | `() => Record<string, DashboardCommentAnchor \| null>` |

```ts
interface DashboardCommentAnchor {
  widget: string
}
```

### 文档字段

| 名称       | 说明                    | 类型       |
| ---------- | ----------------------- | ---------- |
| `comments` | 格子上的讨论 id，见上文 | `string[]` |
