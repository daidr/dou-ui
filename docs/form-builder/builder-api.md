---
wide: true
---

# 用代码修改

设计器的组件实例和设计器内部的 `useFormBuilder()` 是同一个对象，可以读当前的表单和选中的节点，也可以调用命令和事务修改表单。

## 命令

命令和设计器里的按钮、快捷键做的事一样，不传 `ids` 时作用于选中的节点：

| 命令                  | 作用                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| `add(type, place?)`   | 新建一个节点并选中它，默认放进选中的容器或选中节点之后，返回它的 id             |
| `remove(ids?)`        | 删除节点                                                                        |
| `duplicate(ids?)`     | 在每个节点之后放一份副本，并选中副本                                            |
| `moveTo(place, ids?)` | 移到容器 `place.parent`（`null` 是最外层）的第 `place.index` 位，位置按移动前算 |
| `moveBy(delta, ids?)` | 在同一个容器里上移（`-1`）或下移（`1`）一位                                     |
| `wrap(ids?)`          | 把同一个容器里的节点放进一个新的分组                                            |
| `addPage(id?)`        | 给标签页或分步加一页                                                            |
| `replace(document)`   | 换掉整张表单，记为一步撤销                                                      |
| `setMode(mode)`       | 切换设计（`design`）和预览（`preview`）                                         |
| `select(ids, mode?)`  | 选中节点，`mode` 为 `replace`、`toggle` 或 `extend`；`null` 选中表单本身        |
| `undo()` / `redo()`   | 撤销、重做                                                                      |

需要一次做好几处修改时，先用 `transaction()` 开一个事务，逐步修改，再用 `dispatch` 提交，整个事务是一步撤销：

```ts
const builder = useFormBuilder()

const tr = builder.transaction()
tr.update('phone', { label: '联系电话', required: true })
tr.move('phone', null, 0)
builder.dispatch(tr, { selection: ['phone'] })
```

`moveTo` 的位置按移动前的子节点算，就像在当前列表里指出一个缝隙。比如分组里依次是 `a`、`b`、`c`，把 `a` 移到 `c` 后面要写 `index: 3`（`c` 之后的缝隙），结果是 `b`、`c`、`a`：

```ts
builder.moveTo({ parent: 'contact', index: 3 }, ['a'])
```

事务的方法按 id 和位置修改，不看选中了什么：

| 事务方法                        | 作用                                                |
| ------------------------------- | --------------------------------------------------- |
| `insert(node, parent?, index?)` | 把节点放进容器（`null` 是表单最外层），默认放在末尾 |
| `remove(id)`                    | 删除节点和它里面的内容                              |
| `update(id, patch)`             | 修改节点的键，值为 `undefined` 时删除这个键         |
| `move(id, parent, index)`       | 移动节点，`index` 按移走之后的位置算                |
| `updateDocument(patch)`         | 修改表单本身的设置，如 `{ layout: 'horizontal' }`   |

事务的每一步都会检查结构，不符合时抛出错误：页面只能放进标签页和分步，标签页和分步里只能放页面，节点不能移到自己里面，id 不能重复。`update` 不能改 `id`、`type` 和 `children`，请改用 `insert`、`remove` 和 `move`。`meta.group` 相同、间隔不到一秒的事务合并成一步撤销；`meta.history` 为 `false` 时不记入撤销。每次修改（包括撤销和重做）都会触发 `change` 事件，参数是这个事务，`steps` 是它做了哪些修改。

从外部换掉整份描述（比如加载另一张表单）时，撤销记录会清空。

## JSON 与检查

工具栏上的 `{ }` 按钮打开表单的 JSON，可以复制、下载，也可以粘贴或打开一个文件来替换整张表单（只读时只能查看、复制和下载）。修改时下方会按路径列出问题，比如 `nodes[0].children[1].label 应为文字`：

- 结构不对（值的类型错了、缺少 `id`、`type`、`children`），或者 id 重复、页面放错了位置，这些问题会让设计器无法工作，改好之前不能应用；
- 字段名重复、表达式引用了不存在的字段、字段类型没有注册、规则用了 `validators` 里没有的校验函数等问题只做提示，仍然可以应用，应用之后可以在设计器里接着改。

给了 `validators` 时，属性面板里的校验函数只能从这些名字里选，JSON 里写了别的名字会被指出来；没给时可以输入任意名字，不做检查。

应用之后是一步撤销。代码里也可以用同样的检查：`checkDocumentShape(data)` 按路径列出结构问题，`checkDocument(document)` 列出内容问题，`documentPaths(document)` 给出每个节点 id 对应的路径；`replace(document)` 换掉整张表单，并记为一步撤销。

## API

### FormBuilder Exposes

| 名称                            | 说明                                                                       | 类型                                                                               |
| ------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `document`                      | 当前的表单描述                                                             | `FormDocument`                                                                     |
| `selection`                     | 选中的节点 id                                                              | `readonly string[]`                                                                |
| `fields`                        | 全部字段类型，内置的和传入的                                               | `ReadonlyMap<string, FormFieldType>`                                               |
| `messages`                      | 设计器当前语言的文字                                                       | `FormBuilderMessages`                                                              |
| `readonly`                      | 设计器是否只读，只读时修改表单的命令什么都不做                             | `boolean`                                                                          |
| `mode` / `setMode`              | 当前模式，切换模式                                                         | `FormBuilderMode` / `(mode: FormBuilderMode) => void`                              |
| `canUndo` / `canRedo`           | 能否撤销、重做                                                             | `boolean`                                                                          |
| `undo` / `redo`                 | 撤销、重做                                                                 | `() => void`                                                                       |
| `add`                           | 新建一个节点并选中，返回它的 id（建不了时为 `undefined`），见[命令](#命令) | `(type: string, place?: FormBuilderInsertPlace) => string \| undefined`            |
| `remove` / `duplicate` / `wrap` | 删除、复制、放进新分组，不传 `ids` 时作用于选中的节点                      | `(ids?: readonly string[]) => void`                                                |
| `moveTo`                        | 移到某个容器的某个位置                                                     | `(place: FormBuilderInsertPlace, ids?: readonly string[]) => void`                 |
| `moveBy`                        | 在同一个容器里上移或下移                                                   | `(delta: -1 \| 1, ids?: readonly string[]) => void`                                |
| `addPage`                       | 给标签页或分步加一页                                                       | `(id?: string) => void`                                                            |
| `replace`                       | 换掉整张表单，记为一步撤销                                                 | `(document: FormDocument) => void`                                                 |
| `select`                        | 选中节点，`mode` 为 `'replace'`（默认）、`'toggle'` 或 `'extend'`          | `(ids: string \| readonly string[] \| null, mode?: FormBuilderSelectMode) => void` |
| `selectParent`                  | 选中最后选中的节点所在的容器                                               | `() => void`                                                                       |
| `transaction`                   | 基于当前表单开一个事务                                                     | `() => FormBuilderTransaction`                                                     |
| `dispatch`                      | 提交事务，整个事务是一步撤销                                               | `(tr: FormBuilderTransaction, options?: FormBuilderDispatchOptions) => void`       |
| `shownPage`                     | 画布上标签页或分步当前显示的那一页                                         | `(container: FormContainerNode) => FormPageNode \| undefined`                      |
