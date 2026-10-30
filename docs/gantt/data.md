# 数据格式

甘特图的数据是两个扁平数组：任务和依赖，分别用 `v-model:tasks` 和 `v-model:links` 绑定。层级用任务的 `parent` 表示，不嵌套，这样增删改都只动一条记录。

## 任务

```ts
interface GanttTask {
  id: string
  title: string
  parent?: string // 父任务的 id
  order?: string // 同级排序键，按字符串比较
  type?: 'task' | 'milestone'
  start?: string // 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm'
  end?: string
  progress?: number // 0–1
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
  collapsed?: boolean // 收起子任务
  locked?: boolean // 不能拖动和调整
  data?: Record<string, unknown> // 你自己的字段，可以显示成表格的列
}
```

### 时间

时间精确到分钟，有两种写法：

- 只写日期 `2026-03-05`：按整天算。`end` 是最后一天，包含当天，`start: '2026-03-02', end: '2026-03-06'` 是五天。
- 写到分钟 `2026-03-05 14:00`：`end` 是结束的那一刻，`start: '2026-03-05 14:00', end: '2026-03-05 16:30'` 是两个半小时。

两种写法可以混用。时间按字面意思理解，不涉及时区：`09:00` 在任何时区都显示在 9 点的位置。

没有 `end` 时任务默认一天（只写日期时）或一小时（写到分钟时）。没有 `start` 的任务是未排期的，表格里照常显示，时间轴上不画任务条。

### 汇总任务和里程碑

有子任务的任务就是汇总任务。它的起止时间是子任务覆盖的范围，进度是子任务按时长加权的平均值，自己的 `start`、`end`、`progress` 不会被读取。点击表格里的箭头收起或展开子任务，结果写回任务的 `collapsed`。

`type: 'milestone'` 是里程碑，只读 `start`，画成一个菱形。只写日期的里程碑落在那一天的正中。

### 顺序

同级任务默认按数组顺序显示。给任务设置 `order` 后按 `order` 的字符串大小排序，没有 `order` 的任务排在数组中它前一个任务之后。多人同时编辑时，用 `order` 插入任务不会冲突。

## 依赖

```ts
interface GanttLink {
  id: string
  from: string // 前置任务
  to: string // 后续任务
  type?: 'fs' | 'ss' | 'ff' | 'sf'
  lag?: number // 间隔的工作日数，可以为负
}
```

| `type`       | 含义                             | 连线                        |
| ------------ | -------------------------------- | --------------------------- |
| `fs`（默认） | 前置任务完成后，后续任务才能开始 | 前置的结束端 → 后续的开始端 |
| `ss`         | 前置任务开始后，后续任务才能开始 | 开始端 → 开始端             |
| `ff`         | 前置任务完成后，后续任务才能完成 | 结束端 → 结束端             |
| `sf`         | 前置任务开始后，后续任务才能完成 | 开始端 → 结束端             |

连线从任务条的一端水平伸出，转直角进入另一个任务；两个任务挨得太近时，连线沿两行之间的缝隙绕回来。

## 列

`columns` 设置表格的列。`title`、`start`、`end`、`duration`、`progress` 是内置列，其他 `key` 读取任务 `data` 里的同名字段。不设 `width` 的列分掉剩下的宽度。

```ts
const columns = [
  { key: 'title' },
  { key: 'owner', label: '负责人', width: 80 },
  { key: 'start', width: 96 },
  { key: 'duration', width: 72, align: 'right' },
]
```

用 `cell` 插槽可以自定义单元格，插槽参数里有 `task`、`column` 和格式化好的 `text`。
