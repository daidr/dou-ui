# 历史版本

`DouEditor` 不保存版本列表：一个版本就是某一刻的文档数据（`getBlocks()` 或 `v-model` 的值），存在哪里、怎么命名由应用决定。编辑器提供三件事：对比两个版本、在差异之间跳转、恢复到某个版本。

<DocDemo src="editor/versions" column />

## 保存版本

不协同时，`v-model` 的值就是当前文档，直接存下来：

```ts
const versions = ref<{ id: string; name: string; createdAt: string; blocks: Block[] }[]>([])

function saveVersion(name: string) {
  versions.value.push({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    blocks: structuredClone(toRaw(blocks.value)),
  })
}
```

版本是普通的 JSON，可以存进数据库，也可以在服务端读取。协同编辑时，在没有编辑器的地方（比如服务端定时保存）用 `readMap` 从共享文档读出当前内容：

```ts
import { readMap } from '@dou-ui/editor/collaboration'

const blocks = readMap(ydoc.getMap('doc'))
```

`readMap` 的第二个参数是编辑器用的扩展，默认 `[editorKit()]`；用了自定义块时要传入同样的扩展。

## 对比

把旧版本传给 `compare`，编辑器变成只读，在当前文档上标出和旧版本的差异：

```vue
<DouEditor v-model="blocks" :compare="version.blocks" />
```

- 新增的块左侧有一条绿色竖线。类型或属性变了的块（比如段落改成标题、换了对齐方式），改过的表格、附件和嵌入，以及文字没变、只改了格式（颜色、链接）的块，左侧是黄色竖线。
- 删除的块显示在原来的位置，红色删除线；附件、嵌入和图片显示文件名或说明。
- 改过文字的块逐字对比：新增的文字绿色底加下划线，删除的文字红色删除线显示在原来的位置。

块按 `id` 对应，所以移动过的块不算修改，只在内容变了时标出。评论不算修改。对比时查找面板只能查找，不能替换。`compare` 设为 `null` 回到编辑。

`nextChange()` 和 `previousChange()` 依次滚动到下一处、上一处差异，读屏会读出这处是新增、删除还是修改，以及其中的文字；没有更多时返回 `false`，可以接在自己的按钮上。

只想知道改了多少，不需要显示时，用 `diffBlocks`：

```ts
import { diffBlocks } from '@dou-ui/editor'

const { added, removed, updated, changes } = diffBlocks(version.blocks, blocks.value)
// 版本列表里显示“新增 2 段，删除 1 段，修改 3 段”：added.length 等
```

`changes` 按当前文档的顺序列出每个改动的块，删除的块排在它原来后面那个块之前。逐字对比文字用 `diffText(before, after)`。

## 恢复

`restore(blocks)` 把文档换成某个版本的内容，算一次修改，可以撤销。只替换有差异的部分；协同编辑时只把这些块写进共享文档，每个人都会同步看到恢复后的内容，别人正在编辑的其他块不受影响。恢复后读屏会读出“已恢复到这个版本”。文档没有差异时返回 `false`。和其他实例方法一样，`readonly` 时也可以恢复；对比时（传了 `compare`）文档不能修改，`restore` 是唯一能用的修改。恢复会触发 `transaction` 事件，`meta.origin` 为 `'restore'`。

恢复前编辑器不会自动保存版本。想让用户能回到恢复前的样子，在调用前先存一份：

```ts
function restore(version: Version) {
  saveVersion('恢复前')
  editor.value?.restore(version.blocks)
}
```

恢复的内容里如果有当时的评论标记，讨论已经不在 `comments` 里的不会显示高亮。

## API

### Props

| 名称      | 说明                                               | 类型              | 默认值 |
| --------- | -------------------------------------------------- | ----------------- | ------ |
| `compare` | 要对比的旧版本；传入时编辑器只读，并标出和它的差异 | `Block[] \| null` | —      |

### 实例方法

| 名称             | 说明                                                 | 类型                                  |
| ---------------- | ---------------------------------------------------- | ------------------------------------- |
| `restore`        | 换成某个版本的内容，可以撤销；没有差异时返回 `false` | `(blocks: PartialBlock[]) => boolean` |
| `nextChange`     | 对比时滚动到下一处差异，没有更多时返回 `false`       | `() => boolean`                       |
| `previousChange` | 对比时滚动到上一处差异                               | `() => boolean`                       |

### 工具函数

| 名称         | 说明                                                                                          | 类型                                                      |
| ------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `diffBlocks` | 两个版本之间新增、删除、修改的块                                                              | `(before: Block[], after: Block[]) => BlocksDiff`         |
| `diffText`   | 逐字对比两段文字                                                                              | `(before: string, after: string) => TextPart[]`           |
| `inlineText` | 块的文字内容转成字符串：换行是 `\n`，提及等行内节点各占一个 `￼`，和 `diffText` 的位置一一对应 | `(content: InlineContent[]) => string`                    |
| `readMap`    | 从共享文档读出当前内容，从 `@dou-ui/editor/collaboration` 引入                                | `(map: Y.Map, extensions?: EditorExtension[]) => Block[]` |

```ts
type BlockVersionChange =
  | { type: 'added'; id: string; after: Block }
  | { type: 'removed'; id: string; before: Block; next: string | null } // next：它原来在哪个块前面，null 是末尾
  | { type: 'updated'; id: string; before: Block; after: Block }

interface BlocksDiff {
  changes: BlockVersionChange[]
  /** 新增、删除、修改的块的 id，和 transaction 事件里的 changes 一样；要数量时取 length */
  added: string[]
  removed: string[]
  updated: string[]
}

interface TextPart {
  type: 'same' | 'added' | 'removed'
  text: string
}
```
