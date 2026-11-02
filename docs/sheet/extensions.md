# 扩展

扩展把单元格类型、命令、快捷键、菜单项、工具栏按钮、导入导出方式、浮层和修改钩子打包在一起，用 `extensions` 传给表格，适合在多个表格之间复用一组定制。

## 基础用法

下面的例子用了两个扩展：一个加了画成进度条的“进度”单元格类型，右键菜单里多一项“标为完成”；另一个定义了“填入今天”命令，工具栏按钮、右键菜单和 `Ctrl` / `⌘` + `;` 都运行它。

<DocDemo src="sheet/extension" column />

```ts
import { defineSheetCellType, defineSheetExtension } from '@dou-ui/sheet'

const progress = defineSheetExtension({
  name: 'progress',
  cellTypes: [
    defineSheetCellType({
      name: 'progress',
      parse: (text) => ({ value: Number.parseFloat(text) / 100 }),
      format: (value) => `${Math.round(Number(value) * 100)}%`,
      render: ProgressBar,
    }),
  ],
})

const extensions = [progress]
```

```vue-html
<DouSheet v-model="book" :extensions="extensions" />
```

- `defineSheetExtension`、`defineSheetCellType` 只用来提供类型，返回传入的对象本身。
- 扩展的名字不能重复，重复时抛出错误。
- 扩展列表在 `<script setup>` 里创建一次即可。模板里每次渲染写出的新数组，只要里面的扩展相同，就不会重新初始化。

编辑、选择、剪贴板、填充、合并和内置的单元格类型是组件自带的，`extensions` 在这些功能之上追加。

各部分的写法见：

- [自定义单元格类型](./custom-cell-types)：`cellTypes`
- [命令与工具栏按钮](./commands)：`commands`、`keymap`、`contextMenu`、`toolbar`
- [导出器与导入器](./exporters)：`exporters`、`importers`
- [自定义函数](./formulas#自定义函数)：`functions`
- 本页下文：修改钩子、图层和浮层、撤销记录

## 修改钩子

下面的例子用到了 `update`（未保存提示）、`layers`（进度不到一半的行标成浅红色）和单元格类型的 `draw`（导出图片时画出进度条）。

<DocDemo src="sheet/extension-hooks" column />

`transaction` 和 `update` 的区别是时机：

- `transaction` 在修改生效前按优先级调用，可以往里加步骤，或者[取消修改](#取消修改)。撤销时，加上的步骤一起撤销。
- `update` 在修改生效后调用，表格已经是新的内容，用来同步外部状态，比如提示“有未保存的修改”。

表格里的修改、`transact`、撤销重做、协同编辑里别人的修改，以及通过 `v-model` 换进来的新工作簿都会调用 `update`；被取消的修改不会调用。

```ts
const unsaved = ref(false)
const saveReminder = defineSheetExtension({
  name: 'save-reminder',
  update: ({ transaction }) => {
    // 别人的修改由他们自己保存
    if (transaction && transaction.meta.origin !== 'remote') unsaved.value = true
  },
})
```

在 `update` 里调用 `transact` 会产生新的修改，又会调用 `update`。确实需要时，给自己的修改设上 `origin`，在 `update` 里遇到它就跳过，以免循环：

```ts
update: ({ transaction }, ctx) => {
  if (transaction?.meta.origin === 'stamp') return
  ctx.transact((tr) => tr.setCell('Z1', new Date().toISOString()), { origin: 'stamp' })
}
```

## 取消修改

在 `transaction` 里调用 `tr.cancel(reason?)` 取消这次修改。比如 A 列由系统填写，不让人改：

```ts
const systemColumn = defineSheetExtension({
  name: 'system-column',
  transaction: (tr) => {
    if (tr.meta.origin === 'system') return
    if (tr.steps.some((step) => step.type === 'setCell' && step.col === 0))
      tr.cancel('A 列由系统填写')
  },
})
```

- 取消的修改不会生效，也不进撤销记录，后面的扩展不再收到它，`update` 也不会调用。
- 表格下方显示 `reason`，读屏也会读出；不写时显示“这次修改没有生效”。
- 组件触发 `transactionCancel` 事件，`tr.cancelReason` 是取消的原因。`transact` 返回的事务 `tr.cancelled` 为 `true`。
- 撤销、重做和协同编辑里别人的修改（`meta.history` 为 `false`）已经发生过，不能取消，调用 `cancel()` 不起作用。

[保护](./protect)也会取消违反它的修改，同样触发 `transactionCancel`。在事件里用 `checkProtection(tr)` 可以分清是被保护还是被扩展取消的。

## 改写粘贴的内容

`transformPaste` 在粘贴之前，以及“从当前单元格放入”的导入之前，按优先级改写单元格，返回 `null` 取消。组件的 `paste` 事件在它之后，收到改写后的内容。比如去掉文字两端的空格：

```ts
const trim = defineSheetExtension({
  name: 'trim',
  transformPaste: (clip) => ({
    ...clip,
    cells: clip.cells.map((line) =>
      line.map((cell) => (typeof cell === 'string' ? cell.trim() : cell)),
    ),
  }),
})
```

剪切后在表格里粘贴是移动单元格，公式里的引用会跟着移动；改写了内容时，原来的单元格照样清空，放下的是改写后的内容，这时引用不跟着移动。两种情况都只算一步撤销。

## 图层与浮层

- `overlays` 是浮在表格上方的组件，不随表格滚动。
- `layers` 是画在单元格这一层的组件，不盖住表头、提示和菜单，也不接收点击。`below` 在表格自己的标记（复制的区域、公式引用的区域）下面，`above` 在它们上面，编辑框总在最上面。

两者都用 `useSheet()` 的 `cellRect`、`rangeRect` 定位，跟着滚动更新，见 [useSheet](./use-sheet)。[协同编辑](./collaboration)里别人的选区就画在 `layers.below` 里。图层只画在屏幕上，不进导出的图片和打印；要在图片里画出来，用单元格类型的 `draw`。

## 撤销记录

`history` 返回撤销和重做的实现。有它时表格不再记录自己的撤销步骤，撤销按钮、`Ctrl` + `Z` 和 `undo()` 都交给它。[协同编辑](./collaboration)用它只撤销自己的修改。

讨论的位置（单元格的 `comment`）不进撤销记录：撤销一次修改时，单元格上的讨论应该留在原处。自己实现撤销时，用 `keepCommentAnchors(before, tr)` 把讨论放回去：

```ts
import { keepCommentAnchors, sheetCommentAnchors } from '@dou-ui/sheet'

const before = sheetCommentAnchors(ctx.doc.value)
ctx.transact(
  (tr) => {
    applyMyUndo(tr)
    keepCommentAnchors(before, tr)
  },
  { action: 'undo', history: false },
)
```

`before` 是撤销前读出的讨论位置，`tr` 是做撤销的事务。被撤销的插入、删除、移动行列会让讨论跟着单元格走，所在行列被撤销删掉的讨论不再放回。

## API

### 扩展的字段

`ctx` 和组件里 `useSheet()` 拿到的是同一个对象。

| 名称             | 说明                                                                                 | 类型                                                              |
| ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `name`           | 扩展的名字                                                                           | `string`                                                          |
| `priority`       | 优先级，越大越先处理按键和钩子                                                       | `number`，默认 `100`                                              |
| `cellTypes`      | 单元格类型，见[自定义单元格类型](./custom-cell-types)                                | `SheetCellType[]`                                                 |
| `functions`      | 公式里可以调用的函数，见[自定义函数](./formulas#自定义函数)                          | `SheetFunction[]`                                                 |
| `commands`       | 命令，见[命令](./commands)                                                           | `Record<string, SheetCommand>`                                    |
| `keymap`         | 快捷键，见[快捷键](./commands#快捷键)                                                | `(ctx) => Record<string, ((event) => boolean \| void) \| string>` |
| `contextMenu`    | 右键菜单的项，排在内置项前面                                                         | `(ctx, menu: SheetMenuContext) => SheetMenuItem[]`                |
| `toolbar`        | `DouSheetToolbar` 上的按钮，见[工具栏按钮](./commands#工具栏按钮)                    | `(ctx) => SheetToolbarItem[]`                                     |
| `exporters`      | 导出方式，见[导出器与导入器](./exporters)                                            | `SheetExporter[]`                                                 |
| `importers`      | 导入方式，比内置的 CSV 先询问                                                        | `SheetImporter[]`                                                 |
| `overlays`       | 浮在表格上方的组件                                                                   | `Component[]`                                                     |
| `layers`         | 画在单元格上的组件                                                                   | `{ below?: Component[]; above?: Component[] }`                    |
| `comments`       | 把讨论保存在 `v-model:comments` 以外的地方，只能有一个扩展提供，见[评论](./comments) | `(ctx) => SheetCommentsProvider`                                  |
| `history`        | 替换表格自带的撤销记录，多个扩展都有时用优先级最高的                                 | `(ctx) => SheetHistoryHandler`                                    |
| `setup`          | 表格挂载后调用，可以返回一个在卸载时调用的函数                                       | `(ctx) => void \| (() => void)`                                   |
| `transaction`    | 每次修改生效前调用                                                                   | `(tr, ctx) => void`                                               |
| `update`         | 每次修改生效后调用                                                                   | `(update: SheetUpdate, ctx) => void`                              |
| `transformPaste` | 粘贴之前改写单元格，返回 `null` 取消                                                 | `(clip: SheetClip, ctx) => SheetClip \| null`                     |

### SheetUpdate

| 属性          | 说明                                                                                             | 类型                       |
| ------------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| `before`      | 修改前的工作簿                                                                                   | `SheetWorkbook`            |
| `doc`         | 现在的工作簿                                                                                     | `SheetWorkbook`            |
| `transaction` | 这次修改；协同编辑里别人的修改 `meta.origin` 是 `'remote'`；通过 `v-model` 换了工作簿时为 `null` | `SheetTransaction \| null` |

### SheetHistoryHandler

| 属性      | 说明                                   | 类型            |
| --------- | -------------------------------------- | --------------- |
| `undo`    | 撤销，没有可以撤销的修改时返回 `false` | `() => boolean` |
| `redo`    | 重做                                   | `() => boolean` |
| `canUndo` | 能否撤销                               | `() => boolean` |
| `canRedo` | 能否重做                               | `() => boolean` |

### SheetCommentsProvider

| 属性      | 说明                     | 类型                                      |
| --------- | ------------------------ | ----------------------------------------- |
| `threads` | 所有讨论，保持最新       | `Readonly<Ref<readonly CommentThread[]>>` |
| `apply`   | 应用当前用户做的一次修改 | `(action: CommentAction) => void`         |
