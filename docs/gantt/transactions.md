# 用代码修改

`transact` 把多处修改合成一次提交，撤销时也作为一步。拖动、表格编辑和撤销重做内部也走同样的流程。

## 基础用法

```ts
const tr = gantt.value.transact((tr) => {
  tr.setSpan('fe', '2026-03-09', '2026-03-13')
  tr.updateTask('fe', { progress: 0.2 })
  tr.addLink({ id: 'l5', from: 'be', to: 'qa' })
})
tr.changed // 是否真的改动了
```

`transact` 返回这次的事务。`readonly` 只限制界面上的编辑，`transact` 仍然可以修改。

## 修改事件

每次修改，不论来自拖动、撤销还是 `transact`，都会更新 `v-model` 并触发 `transaction` 事件：

- `steps` 是这次修改的步骤列表，`inverse` 是撤销它的步骤；
- 可以用来同步到服务端或做协同编辑，另一端用 `applyGanttSteps(doc, steps)` 应用；
- 被扩展[取消](./extensions#取消修改)的修改不会生效，触发的是 `transactionCancel` 事件。

```vue
<DouGantt v-model="plan" @transaction="(tr) => save(tr.steps)" />
```

## 撤销记录

`setMeta` 设置这次修改怎么进入撤销记录：

- `history: false` 不进入撤销记录，比如应用来自其他客户端的修改；
- 同一 `group` 的连续修改（相隔不到一秒）合并为一步；
- `schedule: false` 在[自动排期](./scheduling)时不推动后续任务；
- `origin` 标出修改来自哪里，在 `transaction` 事件里可以读到。

```ts
gantt.value.transact((tr) => tr.updateTask('fe', remote), { history: false, schedule: false })
```

## API

### GanttTransaction 的方法

| 方法                           | 说明                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `addTask(task, index?)`        | 添加任务                                                                             |
| `removeTask(id)`               | 删除任务，连同它的子任务和相关依赖                                                   |
| `updateTask(id, patch)`        | 修改任务的字段，值为 `undefined` 的字段会被删除                                      |
| `setSpan(id, start, end)`      | 设置起止时间，写法和任务的 `start`、`end` 一样，也可以传分钟数；按任务原来的格式写回 |
| `moveTask(id, parent, index?)` | 把任务连同子任务移到 `parent` 下（`undefined` 为顶层）的第 `index` 位，默认最后      |
| `updateData(id, patch)`        | 合并到任务的 `data`                                                                  |
| `addLink(link, index?)`        | 添加依赖                                                                             |
| `removeLink(id)`               | 删除依赖                                                                             |
| `updateLink(id, patch)`        | 修改依赖                                                                             |
| `getTask(id)` / `getLink(id)`  | 读取修改到这一步时的任务、依赖                                                       |
| `linksOf(id)`                  | 连到或连出某个任务的依赖                                                             |
| `setMeta(meta)`                | 设置 `history`、`group`、`schedule`、`origin`                                        |
| `cancel(reason?)`              | 在扩展的 `transaction` 里取消这次修改                                                |

### GanttTransaction 的属性

| 名称           | 说明                 | 类型                   |
| -------------- | -------------------- | ---------------------- |
| `before`       | 修改前的文档         | `GanttDocument`        |
| `doc`          | 修改后的文档         | `GanttDocument`        |
| `steps`        | 这次修改的步骤       | `GanttStep[]`          |
| `inverse`      | 撤销它的步骤         | `GanttStep[]`          |
| `meta`         | `setMeta` 设置的信息 | `GanttTransactionMeta` |
| `changed`      | 有步骤并且没有被取消 | `boolean`              |
| `cancelled`    | 是否被取消           | `boolean`              |
| `cancelReason` | 取消的原因           | `string \| undefined`  |

### GanttTransactionMeta

| 名称       | 说明                                  | 类型      | 默认值 |
| ---------- | ------------------------------------- | --------- | ------ |
| `history`  | 是否进入撤销记录                      | `boolean` | `true` |
| `group`    | 一秒内同一组的连续修改撤销时合为一步  | `string`  | —      |
| `schedule` | 自动排期时是否推动后续任务            | `boolean` | `true` |
| `origin`   | 修改来自哪里，传给 `transaction` 事件 | `string`  | —      |
