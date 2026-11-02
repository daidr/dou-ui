# 自动排期

默认是手动排期：拖动哪个任务只改哪个，依赖只用来画线和检查。后续任务开始得比依赖允许的早时，这条依赖线显示为虚线。

## 基础用法

`scheduling="auto"` 开启自动排期：移动任务、延长任务或新建依赖后，等着它的后续任务按依赖往后推，工期不变。

<DocDemo src="gantt/scheduling" column />

- 被推动的任务和这次修改在同一个事务里，撤销一次就全部还原。
- 拖动时，被推动的任务在新位置显示虚线轮廓，松开后才写入。
- 被推动的任务同样要经过 [`canMove`](./editing#移动的限制) 检查。

自动排期只往后推，不会把任务往前拉。刚刚被拖动的任务和 `locked: true` 的任务不会被推动，它们的前置依赖如果因此不满足，依赖线显示为虚线。

## 怎么计算

- 比较依赖时只算工作时间：周五结束的任务和下周一开始的任务是紧挨着的。
- 依赖的类型和 `lag` 都会计算在内，见[依赖](./data#依赖)。
- 连到汇总任务的依赖对它的每个子任务生效，从汇总任务连出的依赖按全部子任务的起止时间计算。
- 只有日期的里程碑落在当天结束时：前一个任务周五结束，里程碑就在周五。

## 重新排期

`schedule()` 按依赖重新排一次期，也作为一步撤销，手动排期下也能用，适合做成一个按钮。默认同样只往后推；`schedule({ pull: true })` 还会把有前置依赖的任务拉到依赖允许的最早时间，排得最紧凑。

## 关键路径

`critical` 突出显示关键路径，也就是没有任何空余时间的任务，其中任何一个延期都会推迟整个计划的结束时间。关键任务画成红色，连接它们的依赖线也是红色。示例里“接口开发”和“使用文档”有空余时间，不在关键路径上。

## 不用组件

排期的计算也可以单独使用，比如在服务端检查计划：

```ts
import { computeCriticalPath, computeSchedule, findBrokenLinks } from '@dou-ui/gantt'

const { moves, violated, cycle } = computeSchedule(plan, { calendar, pull: false })
const { tasks: critical } = computeCriticalPath(plan, { calendar })
const broken = findBrokenLinks(plan, { calendar })
```

返回值里是 `Map` 和 `Set`，需要转成 JSON 时先换成普通对象和数组，如 `Object.fromEntries(moves)`、`[...violated]`。

## API

### 相关 Props

| 名称         | 说明                                                   | 类型                 | 默认值     |
| ------------ | ------------------------------------------------------ | -------------------- | ---------- |
| `scheduling` | `manual` 只改动拖动的任务；`auto` 同时把后续任务往后推 | `'manual' \| 'auto'` | `'manual'` |
| `critical`   | 突出显示关键路径                                       | `boolean`            | `false`    |

### 函数

| 名称                                 | 说明                                              | 返回值              |
| ------------------------------------ | ------------------------------------------------- | ------------------- |
| `computeSchedule(doc, options?)`     | 算出满足全部依赖需要怎样移动任务                  | `GanttSchedule`     |
| `computeCriticalPath(doc, options?)` | 算出关键路径，`tasks` 和 `links` 都是 id 的 `Set` | `GanttCriticalPath` |
| `findBrokenLinks(doc, options?)`     | 没有满足的依赖的 id                               | `Set<string>`       |

`options` 都可以传 `calendar`；`computeSchedule` 还可以传 `pull`（也往前拉）和 `fixed`（不移动的任务 id）。

### GanttSchedule

`schedule()` 和 `computeSchedule()` 的返回值：

| 名称       | 说明                                               | 类型                          |
| ---------- | -------------------------------------------------- | ----------------------------- |
| `moves`    | 需要移动的任务和它们新的 `start`、`end`            | `Map<string, { start, end }>` |
| `violated` | 排期之后仍然没有满足的依赖，比如连到锁定的任务     | `Set<string>`                 |
| `cycle`    | 处在循环依赖上（或在它之后）的任务，它们不会被移动 | `string[]`                    |
