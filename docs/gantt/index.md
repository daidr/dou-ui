# 甘特图

`@dou-ui/gantt` 提供甘特图 `DouGantt`：左边是任务表格，右边是时间轴上的任务条，任务之间可以有依赖。适合做项目排期、迭代计划这类"任务 + 起止时间 + 前后关系"的展示和编辑。

## 安装

甘特图是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/gantt
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/gantt/style.css'
import { DouGantt } from '@dou-ui/gantt'

app.use(DouGantt)
```

## 基础用法

`v-model:tasks` 绑定任务列表，`v-model:links` 绑定任务之间的依赖，格式见[数据格式](./data)。有子任务的任务是汇总任务，它的起止时间和进度由子任务算出；`type: 'milestone'` 的任务是里程碑，画成一个菱形。

<DocDemo src="gantt/basic" column />

## 编辑

不设置 `readonly` 时，甘特图可以直接拖动编辑，改动通过 `v-model:tasks` 和 `v-model:links` 写回：

- 拖动任务条改动起止时间，工期（工作日或工作小时）不变，跨过休息日时任务条相应变长；选中多个任务时一起移动，拖动汇总任务会移动它的全部子任务。
- 拖动任务条两端调整开始或结束时间，拖动底部的圆点调整进度。
- 从任务条两侧的连接点拖到另一个任务条上，新建一条依赖。落在目标任务条的左半边连到它的开始，右半边连到它的结束，由此决定依赖类型。
- 在未排期任务那一行的时间轴上拖动，为它画出起止时间。
- 点击依赖线选中它，按 `Delete` 删除。

拖动时显示新的起止时间和工期，表格同步更新，松开后才写回；拖动中按 `Escape` 取消。只精确到日期的任务按整天对齐；精确到分钟的任务按缩放程度对齐，日刻度下按整天，小时刻度下按 1 小时、30 分钟或 15 分钟。拖到时间轴边缘时会自动滚动。触屏上按住任务条片刻再拖动，直接滑动则是滚动时间轴。

`locked: true` 的任务不能拖动。`readonly` 关闭全部编辑。

<DocDemo src="gantt/editing" column />

### 在表格里编辑

双击单元格可以直接修改，`Enter` 确认，`Esc` 取消，点到别处也会确认。任务名、开始、结束、工期和进度都能改：改开始时间会整体移动任务，工期不变；改工期按工作日（精确到分钟的任务按工作小时）重新算结束时间。汇总任务的时间和进度由子任务算出，不能直接改。键盘焦点在任务上时按 `F2` 修改任务名。

表格最下面一行用来添加任务，输入名称后按 `Enter`，可以连续添加。新任务接在最后一个有日期的任务后面，占一个工作日；之后可以拖动或修改时间。不需要这一行时设 `:add-row="false"`。

输入的值无法识别时（例如工期填了文字），输入框会保留并标红，读屏会提示未修改。

拖动表格的行可以调整顺序：落在两行之间时插到那里，落在一行的中间时成为它的子任务。触屏上按住片刻再拖动。`Ctrl` / `⌘` + `]` 把任务变成上一个任务的子任务，`Ctrl` / `⌘` + `[` 移出上级；修改任务名时按 `Tab`、`Shift` + `Tab` 也可以。

调整顺序只改被移动任务的 `parent` 和 `order`。`order` 是比较字符串大小的排序键，`orderBetween(a, b)` 可以生成两个键之间的新键，在服务端插入任务时也能用。

### 右键菜单

在任务条、表格的行、依赖线或时间轴空白处点右键，或者按键盘上的菜单键（`Shift` + `F10`），会打开菜单；触屏上按住任务条或行片刻后松手也会打开。内置的菜单项有重命名、在下方添加任务、添加子任务、缩进、取消缩进、删除任务和删除依赖；在时间轴空白处添加的任务从点击的那天开始。

扩展可以用 `contextMenu` 加自己的项，排在内置项前面；`menu` 设为 `false` 时只显示扩展的项。`target.kind` 是 `task`、`link` 或 `canvas`（时间轴空白处），`target.point` 是打开菜单的位置（时间轴坐标），`target.time` 是该位置对应的时间（分钟），可以用来在点击的地方添加任务或里程碑。从表格或键盘打开时，位置在任务的开始处。`taskContextmenu`、`linkContextmenu` 事件先于菜单触发，调用 `event.preventDefault()` 就不打开菜单。

```ts
const details = defineGanttExtension({
  name: 'details',
  contextMenu: (ctx, target) =>
    target.kind === 'task'
      ? [{ key: 'details', label: '查看详情', icon: FileTextIcon, run: () => open(target.task.id) }]
      : [],
})

// 在空白处右键的位置添加里程碑；time 是分钟数，用 formatTime 写成日期
const milestones = defineGanttExtension({
  name: 'milestones',
  contextMenu: (ctx, target) =>
    target.kind === 'canvas'
      ? [
          {
            key: 'milestone',
            label: '在这里添加里程碑',
            run: () =>
              ctx.transact((tr) =>
                tr.addTask({
                  id: crypto.randomUUID(),
                  title: '里程碑',
                  type: 'milestone',
                  start: formatTime(target.time, true),
                }),
              ),
          },
        ]
      : [],
})
```

这些操作也可以通过组件实例调用：`editCell(id, key?)`、`insertTask(near, { where?: 'after' | 'inside', start? })`、`indentTask(id)`、`outdentTask(id)`。

### 撤销与重做

每次拖动是一步，`Ctrl` / `⌘` + `Z` 撤销，`Ctrl` / `⌘` + `Shift` + `Z` 或 `Ctrl` + `Y` 重做，焦点需要在甘特图内。也可以通过组件实例调用 `undo()`、`redo()`，用 `canUndo`、`canRedo` 控制按钮状态。

展开、收起汇总任务不进入撤销记录。

### 依赖的限制

新建依赖时会拒绝这些情况：连到自己、连到自己的上级或子任务、两个任务之间已经有依赖、会形成循环依赖。拖到这样的任务条上时，任务条显示为不可连接，并提示原因。

`can-link` 可以加上自己的限制：返回 `true` 允许，返回字符串则拒绝并把它作为提示。其他返回值都会拒绝，注意最后要 `return true`，漏写时开发环境下会提示。上面的示例里，已完成的任务不能再加前置任务。

### 移动的限制

`can-move` 在写入新的起止时间之前检查，拖动和键盘操作都会经过它。参数里的 `start`、`end` 是将要写入的值，写法和任务原来的一样；返回 `true` 允许，返回字符串则拒绝并作为提示，其他返回值按“不能移到这里”拒绝。拖动时被拒绝的任务条显示为红色边框，松开后不会写入。

```ts
const canMove = ({ start }: GanttMove) => start >= today || '不能排在今天之前'
```

### 键盘操作

甘特图获得焦点后可以只用键盘操作，读屏软件会播报当前任务和每次修改的结果。

| 按键                        | 作用                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `↑` / `↓`、`Home` / `End`   | 选择上一个、下一个、第一个、最后一个任务                             |
| `←` / `→`                   | 收起、展开汇总任务；在子任务上按 `←` 回到上级                        |
| `Space` / `Enter`           | 加选或取消选中当前任务；只选中当前任务                               |
| `Alt` + `←` / `→`           | 把任务（或选中的全部任务）提前、推后一格，工期不变                   |
| `Alt` + `Shift` + `←` / `→` | 提前、推后结束时间一格                                               |
| `L`                         | 从当前任务添加依赖：`↑` / `↓` 选择后续任务，`Enter` 确认，`Esc` 取消 |
| `Delete`                    | 删除选中的依赖线；没有选中依赖线时删除选中的任务                     |
| `F2`                        | 修改任务名                                                           |
| `Ctrl` / `⌘` + `]` / `[`    | 缩进、取消缩进                                                       |
| 菜单键、`Shift` + `F10`     | 打开当前任务的菜单                                                   |
| `Ctrl` / `⌘` + `Z`          | 撤销                                                                 |

一格的大小和拖动对齐的单位相同。连续按 `Alt` + 方向键移动同一个任务，撤销时作为一步。`focusTask(id)` 可以把键盘焦点放到指定任务上。

### 用代码修改

`transact` 把多处修改合成一次提交，撤销时也作为一步：

```ts
gantt.value.transact((tr) => {
  tr.setSpan('fe', '2026-03-09', '2026-03-13')
  tr.updateTask('fe', { progress: 0.2 })
  tr.addLink({ id: 'l5', from: 'be', to: 'qa' })
})
```

每次修改，不论来自拖动、撤销还是 `transact`，都会更新 `v-model` 并触发 `transaction` 事件。事件参数里的 `steps` 是这次修改的步骤列表，`inverse` 是撤销它的步骤，可以用来同步到服务端或做协同编辑；另一端用 `applyGanttSteps(doc, steps)` 应用。

| 方法                           | 说明                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `addTask(task, index?)`        | 添加任务                                                                             |
| `removeTask(id)`               | 删除任务，连同它的子任务和相关依赖                                                   |
| `updateTask(id, patch)`        | 修改任务的字段，值为 `undefined` 的字段会被删除                                      |
| `setSpan(id, start, end)`      | 设置起止时间，写法和任务的 `start`、`end` 一样，也可以传分钟数；按任务原来的格式写回 |
| `updateData(id, patch)`        | 合并到任务的 `data`                                                                  |
| `addLink(link, index?)`        | 添加依赖                                                                             |
| `removeLink(id)`               | 删除依赖                                                                             |
| `updateLink(id, patch)`        | 修改依赖                                                                             |
| `setMeta({ history, group })`  | `history: false` 不进入撤销记录；同一 `group` 的连续修改合并为一步                   |
| `setMeta({ schedule: false })` | 自动排期时不推动后续任务，比如应用来自其他客户端的修改                               |

## 自动排期

默认是手动排期：拖动哪个任务只改哪个，依赖只用来画线和检查。后续任务开始得比依赖允许的早时，这条依赖线显示为虚线。

`scheduling="auto"` 开启自动排期：移动任务、延长任务或新建依赖后，等着它的后续任务按依赖往后推，工期不变。被推动的任务和这次修改在同一个事务里，撤销一次就全部还原。拖动时，被推动的任务在新位置显示虚线轮廓，松开后才写入；被推动的任务同样要经过 `can-move` 检查。

自动排期只往后推，不会把任务往前拉。刚刚被拖动的任务和 `locked: true` 的任务不会被推动，它们的前置依赖如果因此不满足，依赖线显示为虚线。

<DocDemo src="gantt/scheduling" column />

比较依赖时只算工作时间：周五结束的任务和下周一开始的任务是紧挨着的。依赖的类型和 `lag` 都会计算在内；连到汇总任务的依赖对它的每个子任务生效，从汇总任务连出的依赖按全部子任务的起止时间计算。只有日期的里程碑落在当天结束时：前一个任务周五结束，里程碑就在周五。

`schedule()` 按依赖重新排一次期，也作为一步撤销，手动排期下也能用，适合做成一个按钮。默认同样只往后推；`schedule({ pull: true })` 还会把有前置依赖的任务拉到依赖允许的最早时间，排得最紧凑。

### 关键路径

`critical` 突出显示关键路径：没有任何空余时间的任务，任何一个延期都会推迟整个计划的结束时间。关键任务画成红色，连接它们的依赖线也是红色。示例里“接口开发”和“使用文档”有空余时间，不在关键路径上。

### 纯函数

排期的计算也可以单独使用，比如在服务端检查计划：

```ts
import { computeCriticalPath, computeSchedule, findBrokenLinks } from '@dou-ui/gantt'

const { moves, violated, cycle } = computeSchedule({ tasks, links }, { calendar, pull: false })
const { tasks: critical } = computeCriticalPath({ tasks, links }, { calendar })
const broken = findBrokenLinks({ tasks, links }, { calendar })
```

`moves` 是需要移动的任务和它们新的 `start`、`end`；`violated` 是排期之后仍然没有满足的依赖；`cycle` 是处在循环依赖上（或在它之后）的任务，它们不会被移动。`fixed` 选项可以指定不移动的任务。返回值里是 `Map` 和 `Set`，需要转成 JSON 时先换成普通对象和数组，如 `Object.fromEntries(moves)`、`[...violated]`。

## 工具栏

甘特图不内置工具栏，组件实例上的方法可以配合 [Toolbar](/components/toolbar) 自己组合：`undo()`、`redo()`、`schedule()`、`zoomIn()`、`zoomOut()`、`fit()` 显示全部任务、`scrollToToday()` 滚动到今天，`canUndo`、`canRedo` 控制按钮状态。

<DocDemo src="gantt/toolbar" column />

## 标记线

`markers` 在时间轴上画竖向的标记线，比如发布日、代码冻结。`date` 是位置，只写日期时在当天开始处；`label` 显示在表头；`tone` 可选 `neutral`、`primary`、`success`、`warning`、`danger`。

<DocDemo src="gantt/markers" column />

## 时间刻度

不传 `scale` 时，甘特图打开时会选一个能放下全部任务的日宽，并滚动到第一个任务。`v-model:scale` 切换时间刻度：`hour`、`day`、`week`、`month`、`quarter`、`year`。按住 `Ctrl` / `⌘` 滚动滚轮或在触控板上捏合可以连续缩放，缩放以指针所在的时间为中心，日宽跨过某一级的范围时自动换成那一级的表头，`scale` 也随之更新。

<DocDemo src="gantt/scales" column />

时间轴默认覆盖全部任务，两边各留出一屏的空白；滚动到任一端时会继续向外延伸，不需要设置范围。需要固定范围时传 `range`，如 `['2026-01-01', '2026-12-31']`。

## 工作日历

`calendar` 设置哪些天、哪些时段上班。周末和节假日在时间轴上画成浅色底纹，工期按工作日计算；时间精确到分钟的任务，工期按工作时段计算，显示为小时数。

<DocDemo src="gantt/calendar" column />

| 字段       | 说明                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `weekends` | 每周休息的日子，`0` 是周日，默认 `[0, 6]`                                                                        |
| `holidays` | 额外的休息日，`YYYY-MM-DD`                                                                                       |
| `workdays` | 调休上班的日子，优先于 `weekends`                                                                                |
| `hours`    | 每个工作日的上班时段，默认 `['09:00', '18:00']`；有午休时写成多段，如 `[['09:00', '12:00'], ['13:00', '18:00']]` |

## 窄屏

宽度小于 520px 时表格自动收起，只显示时间轴。任务名显示在任务条上或旁边；任务条不在视野里的行，任务名固定显示在时间轴左侧。也可以用 `:table="false"` 主动隐藏表格。
