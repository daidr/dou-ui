# 扩展

扩展把表格列、连线和移动的规则、快捷键、标记线以及时间轴上的额外图层打包在一起，用 `extensions` 传给甘特图。扩展能做的事和组件自己的属性一样，适合把一组相关的定制放在一处，在多个甘特图之间复用。

下面的例子用了两个扩展：一个在表格里加“负责人”列；另一个把一段日子标成“团建”，在时间轴上画出斜纹，加一条标记线，并拒绝把任务移进这段日子。把“前端开发”往后拖试试。

<DocDemo src="gantt/extension" column />

## 定义扩展

```ts
import { defineGanttExtension } from '@dou-ui/gantt'

const owners = defineGanttExtension({
  name: 'owners',
  columns: [{ key: 'owner', title: '负责人', width: 72 }],
})

const extensions = [owners, quietDays('2026-11-09', '2026-11-11', '团建')]
```

`defineGanttExtension` 只用来提供类型，返回传入的对象本身。扩展的名字不能重复，重复时会抛出错误。

甘特图的表格、刻度、拖动和键盘操作都是组件自带的，不是扩展，所以没有默认的扩展套件。`extensions` 只在这些功能之上追加，不会替换掉什么。

## 扩展的字段

| 名称          | 说明                                                                                                                       | 类型                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `name`        | 扩展的名字                                                                                                                 | `string`                                              |
| `priority`    | 优先级，越大越先处理按键和规则，默认 `100`                                                                                 | `number`                                              |
| `columns`     | 加在表格已有列之后的列，写法同 `columns` 属性                                                                              | `GanttColumn[]`                                       |
| `canLink`     | 依赖规则，在 `can-link` 属性之后检查，返回 `true` 允许，返回字符串拒绝并作为提示                                           | `(link, doc) => boolean \| string`                    |
| `canMove`     | 移动规则，在 `can-move` 属性之后检查，用法相同                                                                             | `(move, doc) => boolean \| string`                    |
| `keymap`      | 甘特图有焦点时的快捷键，写法和 `useHotkey` 一样；处理函数返回 `false` 表示没处理，交给下一个                               | `(ctx) => Record<string, (event) => boolean \| void>` |
| `markers`     | 标记线，和 `markers` 属性画在一起；读到的数据变化时重新计算                                                                | `(ctx) => GanttMarker[]`                              |
| `layers`      | 画在时间轴坐标里的组件，`below` 在依赖线下方，`above` 在任务条上方，跟着时间轴滚动                                         | `{ below?: Component[], above?: Component[] }`        |
| `contextMenu` | 右键菜单的项，排在内置项前面，`target.kind` 是 `task`、`link` 或 `canvas`，带 `point` 和 `time`，见[右键菜单](./#右键菜单) | `(ctx, target) => GanttMenuItem[]`                    |
| `overlays`    | 浮在甘特图上方的组件，不随时间轴滚动，比如面板                                                                             | `Component[]`                                         |
| `setup`       | 甘特图挂载后调用，可以返回一个函数，在卸载时调用                                                                           | `(ctx) => void \| (() => void)`                       |
| `transaction` | 每次修改生效前按优先级调用，可以继续往里加步骤，或用 `tr.cancel()` 取消；撤销和重做也会经过这里                            | `(tr, ctx) => void`                                   |
| `history`     | 替换甘特图自带的撤销记录，只用第一个提供它的扩展，例如[协同编辑](./collaboration)只撤销自己的修改                          | `(ctx) => GanttHistoryHandler`                        |

`ctx` 和组件里 `useGantt()` 拿到的是同一个对象。

`history` 返回的对象：

```ts
interface GanttHistoryHandler {
  /** 没有可撤销的修改时返回 false */
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}
```

## 取消修改

在 `transaction` 里调用 `tr.cancel(reason?)` 取消这次修改：它的步骤都不会生效，也不进撤销记录，后面的扩展不再收到它，也不触发 `transaction` 事件。甘特图下方会短暂显示 `reason`，读屏也会读出；不写时显示“这次修改没有生效”。甘特图触发 `transaction-cancel` 事件，`tr.cancelReason` 是取消的原因。`transact` 返回这次的事务：被取消时 `tr.cancelled` 为 `true`，`tr.changed` 为 `false`。比如上线任务的日期由发布系统决定：

```ts
const fixedLaunch = defineGanttExtension({
  name: 'fixed-launch',
  transaction: (tr) => {
    if (tr.steps.some((step) => step.type === 'updateTask' && step.id === 'launch'))
      tr.cancel('上线日期由发布系统决定')
  },
})
```

撤销、重做和协作里别人的修改（`meta.history` 为 `false`）已经发生过，不能取消，调用 `cancel()` 不起作用。流程编辑器和电子表格的扩展用同样的 `tr.cancel()`。

## 图层组件

图层的坐标就是时间轴的坐标：横向从时间轴起点算起，纵向从第一行的顶部算起。用 `position: absolute` 摆放，位置从 `useGantt()` 里取：

- `xOf(time)`：日期字符串或分钟数在时间轴上的横坐标；只写日期时是当天开始处。缩放和滚动时会更新。
- `rowTop(id)`：任务所在行的顶部；任务被收起时返回 `null`。
- `rowHeight`、`dayWidth`：行高和日宽。

```ts
const band = defineComponent(() => {
  const gantt = useGantt()
  const left = computed(() => gantt.xOf('2026-11-09'))
  const right = computed(() => gantt.xOf('2026-11-11'))
  return () =>
    h('div', {
      class: 'quiet-days',
      style: { left: `${left.value}px`, width: `${right.value! - left.value!}px` },
    })
})
```

图层默认会挡住下面的点击和拖动，只用来展示的内容记得加 `pointer-events: none`。

## 快捷键

扩展的快捷键先于甘特图自己的按键处理，多个扩展按 `priority` 从高到低依次询问。处理函数没有返回 `false` 时，按键就算处理过了，甘特图会阻止它的默认行为。表格或插槽里的输入框有焦点时不会触发。

```ts
const duplicate = defineGanttExtension({
  name: 'duplicate',
  keymap: ({ active, tasks, transact }) => ({
    'mod+d': () => {
      const task = tasks.value.find((item) => item.id === active.value)
      if (!task) return false
      transact((tr) =>
        tr.addTask({ ...task, id: crypto.randomUUID(), title: `${task.title} 副本` }),
      )
    },
  }),
})
```

## useGantt

在图层、浮层，以及甘特图的插槽和默认插槽里，`useGantt()` 返回当前甘特图的状态和操作：

| 名称                                             | 说明                                                            |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `tasks`、`links`、`selection`                    | 当前的任务、依赖和选中的任务                                    |
| `active`                                         | 键盘所在的任务                                                  |
| `rows`                                           | 排好的行，带算好的起止时间和汇总                                |
| `preview`                                        | 拖动中将要写入的日期（包括会被推后的任务），不在拖动时为 `null` |
| `readonly`、`scale`、`dayWidth`、`rowHeight`     | 只读状态、当前刻度、日宽、行高                                  |
| `transact`、`undo`、`redo`、`canUndo`、`canRedo` | 修改与撤销，同组件实例                                          |
| `fit`、`zoomIn`、`zoomOut`                       | 缩放                                                            |
| `scrollToDate`、`scrollToTask`、`scrollToToday`  | 滚动                                                            |
| `focusTask(id)`                                  | 把键盘焦点放到任务上                                            |
| `xOf(time)`、`rowTop(id)`                        | 时间和行在时间轴上的位置                                        |
| `announce(text)`                                 | 让读屏软件播报一段文字                                          |
| `messages`                                       | 当前语言的文案                                                  |
