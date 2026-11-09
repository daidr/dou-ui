# 评论

给 `DouFlowEditor` 传入 `v-model:comments`，就可以对节点和连线发起讨论，适合审阅一份流程：在节点上问“这一步要不要限时”，在连线上问“这个条件对不对”。

<DocDemo src="flow/comments" column />

```vue
<script setup lang="ts">
import { DouFlowEditor, type FlowDocument } from '@dou-ui/flow'
import type { CommentThread } from 'dou-ui'
import { ref } from 'vue'

const flow = ref<FlowDocument>({ version: 1, nodes: [], edges: [] })
const threads = ref<CommentThread[]>([])
const active = ref<string | null>(null)
</script>

<template>
  <DouFlowEditor
    v-model="flow"
    v-model:comments="threads"
    v-model:active-comment="active"
    :author="{ id: 'dai', name: '戴兜' }"
  />
</template>
```

不传 `comments` 时没有评论功能。不传 `author` 时可以查看讨论，但不能发起和回复。

## 发起和查看

- 右键节点或连线，选择“评论”；也可以点选中节点或连线时工具栏上的评论按钮。手机上没有右键菜单，用工具栏上的按钮。
- 只用键盘时，选中一个节点或一条连线，按 `Ctrl/⌘` + `Alt` + `M`。
- 有讨论的节点右上角外侧、连线的中点（有文字时在文字上方）会显示一个评论标记，点击打开讨论，可以回复、编辑、删除和标记为已解决。一个地方有几条讨论时，标记上显示条数，卡片里依次列出。
- 点标记只显示讨论，不会在手机上弹出键盘，点回复框再回复；用键盘按标记、按快捷键或选“评论”打开时，焦点直接落在回复框里。
- 节点在折叠的分组里时，它的讨论显示在分组的标记上，打开时卡片也在分组旁边。
- 已经有讨论的地方再选“评论”，会打开已有的讨论，不会再发起一条；折叠的分组上有标记时，打开的是标记上的讨论。
- 标记离得太近时，连线的标记会让到一旁，各自都点得到。
- 讨论也可以钉在节点里的某一点上，见下文[钉在节点上的一点](#钉在节点上的一点)。
- 按 `Esc` 关闭卡片，焦点回到节点（连线时回到画布）上；回复框里有没发出的文字时，第一次按 `Esc` 先清空文字。

## 数据怎么保存

一条讨论分成两部分，分开保存：

- **讨论在哪里**保存在流程文档里：节点和连线的 `comments` 字段是讨论 id 的数组。移动节点、改连线的走向时，讨论跟着走。
- **讨论的内容**（评论、回复、是否已解决）保存在 `v-model:comments` 里，格式见 [CommentThread](/components/comment-thread#数据格式)。

```ts
// 流程文档里的一个节点
{ id: 'finance', x: 320, y: 0, data: { label: '财务复核' }, comments: ['limit'] }

// v-model:comments 里的一条讨论
{ id: 'limit', comments: [{ id: 'l1', author: { id: 'qing', name: '阿青' }, body: '复核要不要限定两个工作日内完成？', createdAt: '…' }] }
```

已解决的讨论不再显示标记，但仍然在 `comments` 里。把 `activeComment` 设为它的 id，卡片会在原来的位置打开，点“重新打开”就恢复了；上面的示例勾选“显示已解决”可以试试。

评论不进撤销记录：按 `Ctrl/⌘` + `Z` 撤销的是流程的修改，不会撤掉刚发出的评论；撤销添加节点再重做时，节点上的讨论也一起回来。发起和删除讨论时修改文档的事务带有 `meta.origin: 'comment'`，扩展的 `transaction` 钩子和 `transaction` 事件可以据此区分，这样的修改不能取消，见[扩展](./extensions)。

讨论只能放在节点和连线上，还不能放在画布的空白处。

### 复制和删除

- 复制、粘贴或“复制一份”得到的节点和连线不带讨论（也不带钉子），讨论仍然只在原来的地方。
- 删除带讨论的节点或连线后，讨论仍然留在 `comments` 里，撤销删除时会回到原处。用 `getCommentAnchors()` 可以查到每条讨论现在在哪里，所在的节点或连线已删除的返回 `null`，可以在侧栏里单独显示，或者自行清理。把 `activeComment` 设为这样一条讨论的 id 时不会打开卡片，示例里把它们显示为不可点击。
- 在卡片里删除整条讨论时，节点或连线上的 id 和钉住的位置会一起去掉。用代码从 `comments` 里删掉讨论时，id 还在，但不再显示；需要清理时用 `transact` 修改节点的 `comments`。

导出的图片里不包含评论。

## 钉在节点上的一点

评审截图、设计稿时，常常要指出“这里的按钮太小”“右上角留白太多”。讨论可以钉在节点里的某一点上：

<DocDemo src="flow/comment-pins" column />

示例里编辑器下方的列表用 `getCommentAnchors()` 读出每条讨论钉在哪里，点一条会打开它。

- 用代码发起：`comment({ node: 'shot', at: { x: 0.8, y: 0.1 } })`。`at` 是这一点在节点里的位置，按节点的宽和高算比例，左上角是 `{ x: 0, y: 0 }`，右下角是 `{ x: 1, y: 1 }`，超出的部分按节点边缘算。带 `at` 时总是发起一条新的讨论，不会打开节点上已有的讨论。发起后焦点默认落在回复框里；由轻点触发时可以传 `comment(anchor, { focus: false })`，只打开卡片，不在手机上弹出键盘，白板的评论工具在触屏上就是这样做的。
- 在[白板](./whiteboard)里用评论工具（M）：点在节点上就在那一点发起讨论，点在画布空白处或拖动时不会发起讨论；手指拖动时平移画布。只用键盘时，选中一个节点后按 `Enter`，在整个节点上发起讨论。

钉住的讨论在那一点上各有一个钉子，钉子左下角的尖角指着这一点，钉子上的数字是它在这个节点上的序号：按发起的先后从 1 开始，已解决的也算在内，所以解决一条讨论不会让其他钉子的数字变化；删除一条讨论后，它后面的钉子数字会减一。已解决的钉子不再显示。节点右上角的标记只算没有钉住的讨论。节点移动、改变大小或旋转时，钉子跟着走。节点在折叠的分组里时，钉住的讨论和其他讨论一样算在分组的标记上。

钉住的位置保存在节点的 `commentPins` 字段里，键是讨论 id；讨论 id 仍然在 `comments` 里：

```ts
{
  id: 'shot',
  type: 'image',
  x: 0,
  y: 0,
  width: 320,
  height: 200,
  data: { src: '/plan-a.png', alt: '方案一' },
  comments: ['whole', 'button'],
  commentPins: { button: { x: 0.8, y: 0.1 } },
}
```

`getCommentAnchors()` 返回的锚点也带着 `at` 和钉子上的数字 `number`，例如 `{ node: 'shot', at: { x: 0.8, y: 0.1 }, number: 1 }`，侧栏里可以显示同样的数字。注意 `at` 是节点内的比例，和 `insertNode` 等方法里画布坐标的 `at` 不同。把讨论交给 AI 处理时，可以据此说明“这条评论在截图的右上角”。

## 和侧栏联动

`v-model:activeComment` 是当前打开的讨论。点击评论标记会更新它；在侧栏里设置它，编辑器会把讨论所在的节点或连线移进视野并打开讨论。上面的示例用它做了一个评论列表，讨论所在的位置通过 `getCommentAnchors()` 读取。

## 保存到服务器

每次修改评论都会触发 `commentAction` 事件，参数是这次修改（`CommentAction`，见 [CommentThread](/components/comment-thread#数据格式)），可以直接发给服务器，也可以用来通知被回复的人。

```vue
<DouFlowEditor
  v-model="flow"
  v-model:comments="threads"
  :author="me"
  @comment-action="(action) => api.post('/comments', action)"
/>
```

注意：发起讨论时流程文档也会改变（节点或连线加上了 `comments`），所以文档也需要保存。

## 只读时评论

`readonly` 时不能修改流程，仍然可以发起和回复讨论，适合审阅：右键菜单和快捷键照常可用，选中节点或连线时工具栏上只有评论按钮，手机上也能发起。白板的工具栏这时只有选择、移动画布和评论三个工具。`commentable` 设为 `false` 时只能查看讨论。

## 协同编辑

使用[协同编辑](./collaboration)时，节点和连线上的 `comments` 和其他字段一样随共享文档同步。讨论的内容不在共享文档里，由应用自己同步，例如收到 `commentAction` 后发给服务器，再把其他人的修改写回 `v-model:comments`。

两个人几乎同时在同一个节点或连线上发起讨论时，`comments` 以后写入的为准，先发起的那条讨论仍在 `comments` 里，但不再挂在节点上，`getCommentAnchors()` 对它返回 `null`；可以据此找出这样的讨论，重新写回节点。

## API

### Props

| 名称            | 说明                                                  | 类型              | 默认值 |
| --------------- | ----------------------------------------------------- | ----------------- | ------ |
| `comments`      | 所有讨论，支持 `v-model:comments`；不传时没有评论功能 | `CommentThread[]` | —      |
| `author`        | 当前用户；不传时只能查看讨论                          | `CommentAuthor`   | —      |
| `activeComment` | 打开的讨论，支持 `v-model:activeComment`              | `string \| null`  | —      |
| `commentable`   | 能否发起和回复讨论，`readonly` 时同样有效             | `boolean`         | `true` |

### Events

| 名称                   | 说明               | 类型                                 |
| ---------------------- | ------------------ | ------------------------------------ |
| `update:comments`      | 讨论变化           | `(threads: CommentThread[]) => void` |
| `update:activeComment` | 打开的讨论变化     | `(id: string \| null) => void`       |
| `commentAction`        | 在这里做的一次修改 | `(action: CommentAction) => void`    |

### 实例方法

| 名称                | 说明                                                                                                                                                                                               | 类型                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `comment`           | 打开节点或连线上的讨论并聚焦回复框，没有讨论时打开输入框；不传时用选中的那一个节点或连线。带 `at` 时总是在那一点发起新的讨论。没有这个节点或连线、没有评论功能，或没有讨论又不能发起时返回 `false` | `(anchor?: FlowCommentAnchor) => boolean`         |
| `getCommentAnchors` | 每条讨论所在的节点或连线，钉住的带着 `at`，已删除的为 `null`。返回值不是响应式的，在 `update:modelValue` 和 `update:comments` 之后重新读取                                                         | `() => Record<string, FlowCommentAnchor \| null>` |

```ts
type FlowCommentAnchor =
  // at：钉住的点，按节点宽高算的比例，0 到 1（不是画布坐标）
  // number：钉子上的数字，只在 getCommentAnchors 返回时有
  { node: string; at?: { x: number; y: number }; number?: number } | { edge: string }
```

### 文档字段

| 名称          | 说明                                                                         | 类型                                       |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| `comments`    | 节点和连线上的讨论 id，见上文                                                | `string[]`                                 |
| `commentPins` | 节点上钉住的讨论的位置，键是讨论 id，见[钉在节点上的一点](#钉在节点上的一点) | `Record<string, { x: number; y: number }>` |
