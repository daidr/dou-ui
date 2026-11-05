---
wide: true
---

# 文档与事务

整个仪表盘是一份 JSON 文档，通过 `v-model` 读写；在代码里修改它时用事务，修改可以撤销，也会触发 `change` 事件。

## 基础用法

点“改成本周订单”用事务改掉一个格子的标题和设置，下方显示这次修改的步骤；撤销、重做按钮用的是实例的 `undo()`、`redo()`。

<DocDemo src="dashboard/transaction" />

## 文档

`v-model` 绑定的文档格式如下：

```ts
import type { DashboardDocument } from '@dou-ui/dashboard'
import { ref } from 'vue'

const doc = ref<DashboardDocument>({
  version: 1,
  widgets: [
    {
      id: 'orders',
      type: 'stat',
      title: '今日订单',
      props: { value: 1286, suffix: '单' },
      place: { lg: { x: 0, y: 0, w: 3, h: 2 } },
    },
  ],
})
```

- `type` 是注册过的格子类型，`props` 是这个格子自己的设置，都必须能被 `JSON.stringify` 保存。
- `title` 可以不写，这时标题栏显示类型的名称。
- `comments` 是格子上的讨论 id，见[评论](./comments)。
- `place` 按断点记录位置，单位是列和行。最宽断点（默认 `lg`）的位置是主位置；较窄的断点没有记录时，按主位置推算，在那个断点上拖动过之后才会写进去。缺少主位置的格子放在第一个放得下的地方。
- 每次修改都会得到一个新的文档对象，没有改动的格子保持原来的对象，可以直接比较引用。

## 修改文档

可以直接给 `v-model` 赋一份新文档，但这样会清空撤销记录。想让修改也能撤销，用 `transaction()` 拿到一个事务，在上面添加、删除、修改格子，再交给 `dispatch`：

```ts
const tr = dashboard.value!.transaction()
tr.update('orders', { title: '本周订单' }).remove('memo')
tr.setMeta('origin', 'toolbar')
dashboard.value!.dispatch(tr)
```

- `update(id, patch)` 里值为 `undefined` 的键会被删掉，`id` 和 `type` 不能改；什么都没改变的步骤会被忽略。
- 一个事务算作一次修改、一步撤销；`meta.group` 相同且间隔不到一秒的修改合并成一步。
- 事务必须基于当前文档创建，文档已经变了再提交会报错。

每次修改都会触发 `change`，参数是这个事务：修改前的文档 `before`、修改后的文档 `doc`、步骤 `steps`、撤销它的步骤 `inverse` 和 `meta`（其中 `origin` 是来源，例如 `layout`、`settings`、`drop`）。

`applySteps(doc, steps)` 一次应用一组步骤并返回事务，不经过组件，可以在服务端或测试里使用，也可以重放保存下来的 `steps`。

## 检查与迁移

保存或展示一份文档之前，可以先检查：

```ts
import { checkDocument, migrateDocument } from '@dou-ui/dashboard'

const doc = migrateDocument(JSON.parse(saved))
const problems = checkDocument(doc, { widgets })
```

- `checkDocument` 找出版本不对、缺少或重复的 id、没有注册的类型，以及不是整格的位置，每一项带 `code`、`path` 和出问题的 `widgetId`。整份数据的形状不对（不是对象，或者 `widgets` 不是数组）时只报 `shape`。
- `migrateDocument` 补全旧文档或手写文档缺少的部分（`version`、`place`），丢掉不是对象的格子和不合法的位置。传入的不是对象（包括数组和 `null`），或者版本不认识时报错，以免把损坏的存档当成空文档再保存回去。
- 还没有存档时用 `emptyDocument()` 新建。

## API

### Dashboard Exposes

| 名称          | 说明                   | 类型                                 |
| ------------- | ---------------------- | ------------------------------------ |
| `transaction` | 基于当前文档创建事务   | `() => DashboardTransaction`         |
| `dispatch`    | 提交事务，算作一次修改 | `(tr: DashboardTransaction) => void` |
| `document`    | 当前文档               | `DashboardDocument`                  |

### DashboardTransaction

| 名称                  | 说明                                                           | 类型                                                |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `add(widget, index?)` | 把格子放进 `widgets` 的第 `index` 位，默认放在末尾             | `(widget: DashboardWidget, index?: number) => this` |
| `remove(id)`          | 删除格子                                                       | `(id: string) => this`                              |
| `update(id, patch)`   | 修改格子的键，值为 `undefined` 时删除这个键                    | `(id: string, patch: DashboardWidgetPatch) => this` |
| `setMeta(key, value)` | 设置 `meta`，如 `origin`、`group`；`history: false` 不记入撤销 | `(key: string, value: unknown) => this`             |
| `before`              | 修改前的文档                                                   | `DashboardDocument`                                 |
| `doc`                 | 应用到目前为止的步骤后的文档                                   | `DashboardDocument`                                 |
| `steps` / `inverse`   | 做过的步骤；撤销它们的步骤，最后一步在前                       | `DashboardStep[]`                                   |
| `meta`                | 附加信息                                                       | `DashboardTransactionMeta`                          |
| `changed`             | 是否有步骤                                                     | `boolean`                                           |

### 函数

| 名称                                 | 说明                                                                                                                                                              | 类型                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `applySteps(doc, steps, meta?)`      | 一次应用一组步骤，返回事务                                                                                                                                        | `(doc: DashboardDocument, steps: readonly DashboardStep[], meta?: DashboardTransactionMeta) => DashboardTransaction` |
| `checkDocument(doc, options?)`       | 检查文档，返回问题列表；`options.widgets` 是注册的格子类型，不给时不检查类型                                                                                      | `(doc: DashboardDocument, options?: CheckDocumentOptions) => DocumentProblem[]`                                      |
| `migrateDocument(data)`              | 把读到的数据补全成当前版本的文档                                                                                                                                  | `(data: unknown) => DashboardDocument`                                                                               |
| `emptyDocument()`                    | 没有格子的新文档                                                                                                                                                  | `() => DashboardDocument`                                                                                            |
| `replaceWidgets(tr, next, options?)` | 往事务里加入从当前文档变成 `next` 所需的步骤，用于“恢复默认”。留下的格子保留现在的 `comments`；`options.keepComments` 为 `false` 时连 `comments` 也改成 `next` 的 | `(tr: DashboardTransaction, next: DashboardDocument, options?: ReplaceWidgetsOptions) => DashboardTransaction`       |

### DocumentProblem

| 名称       | 说明                                                            | 类型                                                                                                        |
| ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `code`     | 问题种类；`bad-comments` 是格子的 `comments` 不是讨论 id 的数组 | `'version' \| 'shape' \| 'duplicate-id' \| 'missing-id' \| 'unknown-type' \| 'bad-place' \| 'bad-comments'` |
| `widgetId` | 出问题的格子；文档本身的问题没有                                | `string \| undefined`                                                                                       |
| `path`     | 出问题的位置，如 `widgets[2].place.lg`                          | `string`                                                                                                    |
| `text`     | 出问题的 id、类型或断点，供提示文字使用                         | `string`                                                                                                    |
| `message`  | 英文说明，用于日志                                              | `string`                                                                                                    |
