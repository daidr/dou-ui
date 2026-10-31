import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface GanttMessages {
  /** The chart's accessible name when none is given. */
  chart: string
  /** Column headers. */
  columns: { title: string; start: string; end: string; duration: string; progress: string }
  /** Short month names, January first. */
  months: string[]
  /** Short weekday names, Sunday first. */
  weekdays: string[]
  /** Header labels. `{year}`, `{month}` (a name from `months`), `{day}`, `{weekday}`, `{quarter}`, `{hour}`. */
  year: string
  yearMonth: string
  month: string
  monthDay: string
  dayWithWeekday: string
  quarter: string
  halves: [string, string]
  hour: string
  /** Durations; `{count}` is a number. */
  days: string
  hours: string
  today: string
  expand: string
  collapse: string
  /** Read out for a task; `{title}`, `{start}`, `{end}`, `{duration}` and `{progress}` are filled in. */
  task: string
  milestone: string
  summary: string
  unscheduled: string
  /** `{date}` and `{time}`. */
  dateTime: string
  /** Shown while dragging: `{start}`, `{end}`, `{duration}`; `{value}` is a percentage. */
  rangeTip: string
  progressTip: string
  /** Why a link being drawn can't be made. */
  linkRefusals: { nested: string; duplicate: string; cycle: string }
  /** Shown when `can-move` refuses without a reason. */
  moveRefused: string
  /** The handle between the list and the timeline. */
  resizeTable: string
  /** How to use the chart with keys; read out when it gets focus. */
  keys: string
  /** Read out: linking by keys (`{title}` is where it starts), what was done. */
  linkMode: string
  linked: string
  linkRemoved: string
  cancelled: string
  /** `{change}` is the task (or link) as it is afterwards. */
  undone: string
  redone: string
  /** For `{change}`: a link's lag or type changed, a task was removed. */
  linkChanged: string
  taskRemoved: string
  /** Read out when a change pushed other tasks: `{task}` is the rest, `{count}` how many. */
  pushed: string
  /** Read out when a change leaves links not kept: `{task}` is the rest, `{count}` how many. */
  broken: string
  /** The title of a task added from the menu. */
  newTask: string
  /** The row below the table that adds a task. */
  addRow: string
  /** Read out when a task is added from the row below the table. */
  taskAdded: string
  /** Read out after indenting or outdenting: `{task}` moved under `{parent}`, or to the top level. */
  movedUnder: string
  movedTop: string
  /** Read out when an edited value can't be read, so the cell keeps its value. */
  invalidValue: string
  /** Read out when tasks are removed; `{titles}` joined with `listSeparator`. */
  tasksRemoved: string
  listSeparator: string
  /** The name of a cell's editor; `{column}` is its header. */
  editCell: string
  /** The built-in context menu items. */
  menu: {
    rename: string
    addAfter: string
    addInside: string
    addTask: string
    indent: string
    outdent: string
    removeTask: string
    /** `{count}` tasks. */
    removeTasks: string
    removeLink: string
  }
  /** Read out after `schedule()`: `{count}` tasks moved. */
  scheduled: string
  /** A task on the critical path, read out: `{task}` is the rest. */
  criticalTask: string
  /** The scheduler's texts. */
  scheduler: {
    /** Its accessible name when none is given. */
    name: string
    /** The header over the resources. */
    resource: string
    /** The row for tasks without a resource. */
    unassigned: string
    /** How to use it with keys; read out when it gets focus. */
    keys: string
    /** A task's dates: `{title}`, `{start}`, `{end}`, `{duration}`. */
    task: string
    /** Read out for a task: `{task}` (its dates, or the milestone text) and `{resource}`. */
    item: string
    /** Read out for a resource: `{title}`, `{count}` tasks. */
    row: string
    /** Added to a resource that takes more than it can at times: `{row}` is the rest. */
    overloaded: string
    /** Beside an overloaded resource's name. */
    overloadHint: string
    /** Read out after a task moved to another resource: `{title}`, `{resource}`. */
    moved: string
  }
}

const zhMonths = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)

const zhCN: GanttMessages = {
  chart: '甘特图',
  columns: { title: '任务', start: '开始', end: '结束', duration: '工期', progress: '进度' },
  months: zhMonths,
  weekdays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  year: '{year}年',
  yearMonth: '{year}年{month}',
  month: '{month}',
  monthDay: '{month}{day}日',
  dayWithWeekday: '{month}{day}日 {weekday}',
  quarter: 'Q{quarter}',
  halves: ['上半年', '下半年'],
  hour: '{hour}:00',
  days: '{count} 天',
  hours: '{count} 小时',
  today: '今天',
  expand: '展开',
  collapse: '收起',
  task: '{title}，{start}至{end}，{duration}，进度 {progress}%',
  milestone: '里程碑：{title}，{start}',
  summary: '{title}，{start}至{end}，进度 {progress}%',
  unscheduled: '{title}，未排期',
  dateTime: '{date} {time}',
  rangeTip: '{start} – {end} · {duration}',
  progressTip: '进度 {value}%',
  linkRefusals: {
    nested: '不能连到自己的上级或子任务',
    duplicate: '这两个任务之间已经有依赖',
    cycle: '会形成循环依赖',
  },
  moveRefused: '不能移到这里',
  resizeTable: '调整列表宽度',
  keys: '上下键选择任务，左右键收起或展开，空格选中；Alt 加左右键移动任务，Alt 加 Shift 加左右键调整结束时间；L 添加依赖；F2 重命名，菜单键打开菜单',
  linkMode: '从“{title}”添加依赖：上下键选择后续任务，Enter 确认，Esc 取消',
  linked: '已添加依赖：{from} → {to}',
  linkRemoved: '已删除依赖',
  cancelled: '已取消',
  linkChanged: '依赖已修改',
  taskRemoved: '{title}，已删除',
  undone: '已撤销：{change}',
  redone: '已重做：{change}',
  pushed: '{task}；另有 {count} 个任务随之推后',
  broken: '{task}；{count} 条依赖未满足',
  scheduled: '已重新排期，移动了 {count} 个任务',
  newTask: '新任务',
  addRow: '添加任务',
  taskAdded: '已添加{title}',
  movedUnder: '{task}已移到{parent}下',
  movedTop: '{task}已移到最外层',
  invalidValue: '{column}无效，未修改',
  tasksRemoved: '已删除：{titles}',
  listSeparator: '、',
  editCell: '编辑{column}',
  menu: {
    rename: '重命名',
    addAfter: '在下方添加任务',
    addInside: '添加子任务',
    addTask: '添加任务',
    indent: '缩进',
    outdent: '取消缩进',
    removeTask: '删除任务',
    removeTasks: '删除 {count} 个任务',
    removeLink: '删除依赖',
  },
  criticalTask: '{task}，关键任务',
  scheduler: {
    name: '资源排期',
    resource: '资源',
    unassigned: '未分配',
    keys: '方向键在任务之间移动，Alt 加左右方向键改时间，Alt 加上下方向键换资源，菜单键打开菜单，Delete 删除，Mod+Z 撤销',
    task: '{title}，{start}至{end}，{duration}',
    item: '{task}，{resource}',
    row: '{title}，{count} 项',
    overloaded: '{row}，有时段超出可承担的数量',
    overloadHint: '有时段超出可承担的数量',
    moved: '{title}已移到{resource}',
  },
}

const zhTW: GanttMessages = {
  ...zhCN,
  chart: '甘特圖',
  columns: { title: '任務', start: '開始', end: '結束', duration: '工期', progress: '進度' },
  weekdays: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'],
  halves: ['上半年', '下半年'],
  hours: '{count} 小時',
  expand: '展開',
  collapse: '收合',
  task: '{title}，{start}至{end}，{duration}，進度 {progress}%',
  milestone: '里程碑：{title}，{start}',
  summary: '{title}，{start}至{end}，進度 {progress}%',
  unscheduled: '{title}，未排程',
  progressTip: '進度 {value}%',
  linkRefusals: {
    nested: '不能連到自己的上層或子任務',
    duplicate: '這兩個任務之間已經有相依關係',
    cycle: '會形成循環相依',
  },
  moveRefused: '不能移到這裡',
  resizeTable: '調整列表寬度',
  keys: '上下鍵選擇任務，左右鍵收合或展開，空白鍵選取；Alt 加左右鍵移動任務，Alt 加 Shift 加左右鍵調整結束時間；L 新增相依；F2 重新命名，選單鍵開啟選單',
  linkMode: '從「{title}」新增相依：上下鍵選擇後續任務，Enter 確認，Esc 取消',
  linked: '已新增相依：{from} → {to}',
  linkRemoved: '已刪除相依',
  cancelled: '已取消',
  linkChanged: '相依已修改',
  taskRemoved: '{title}，已刪除',
  undone: '已復原：{change}',
  redone: '已重做：{change}',
  pushed: '{task}；另有 {count} 個任務隨之延後',
  broken: '{task}；{count} 條相依未滿足',
  scheduled: '已重新排程，移動了 {count} 個任務',
  newTask: '新任務',
  addRow: '新增任務',
  taskAdded: '已新增{title}',
  movedUnder: '{task}已移到{parent}下',
  movedTop: '{task}已移到最外層',
  invalidValue: '{column}無效，未修改',
  tasksRemoved: '已刪除：{titles}',
  editCell: '編輯{column}',
  menu: {
    rename: '重新命名',
    addAfter: '在下方新增任務',
    addInside: '新增子任務',
    addTask: '新增任務',
    indent: '縮排',
    outdent: '取消縮排',
    removeTask: '刪除任務',
    removeTasks: '刪除 {count} 個任務',
    removeLink: '刪除相依',
  },
  criticalTask: '{task}，要徑任務',
  scheduler: {
    name: '資源排程',
    resource: '資源',
    unassigned: '未分配',
    keys: '方向鍵在任務之間移動，Alt 加左右方向鍵改時間，Alt 加上下方向鍵換資源，選單鍵開啟選單，Delete 刪除，Mod+Z 復原',
    task: '{title}，{start}至{end}，{duration}',
    item: '{task}，{resource}',
    row: '{title}，{count} 項',
    overloaded: '{row}，有時段超出可承擔的數量',
    overloadHint: '有時段超出可承擔的數量',
    moved: '{title}已移到{resource}',
  },
}

const en: GanttMessages = {
  chart: 'Gantt chart',
  columns: {
    title: 'Task',
    start: 'Start',
    end: 'End',
    duration: 'Duration',
    progress: 'Progress',
  },
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  year: '{year}',
  yearMonth: '{month} {year}',
  month: '{month}',
  monthDay: '{month} {day}',
  dayWithWeekday: '{weekday}, {month} {day}',
  quarter: 'Q{quarter}',
  halves: ['H1', 'H2'],
  hour: '{hour}:00',
  days: '{count} d',
  hours: '{count} h',
  today: 'Today',
  expand: 'Expand',
  collapse: 'Collapse',
  task: '{title}, {start} to {end}, {duration}, {progress}% done',
  milestone: 'Milestone: {title}, {start}',
  summary: '{title}, {start} to {end}, {progress}% done',
  unscheduled: '{title}, not scheduled',
  dateTime: '{date} {time}',
  rangeTip: '{start} – {end} · {duration}',
  progressTip: '{value}% done',
  linkRefusals: {
    nested: 'Can’t link a task to its own parent or subtask',
    duplicate: 'These tasks are already linked',
    cycle: 'This would make a loop',
  },
  moveRefused: 'Can’t move here',
  resizeTable: 'Resize the list',
  keys: 'Up and Down pick a task, Left and Right fold, Space selects; Alt with Left or Right moves the task, Alt with Shift and Left or Right changes its end; L adds a dependency; F2 renames, the menu key opens the menu',
  linkMode:
    'Adding a dependency from “{title}”: pick the next task with Up and Down, Enter to confirm, Escape to cancel',
  linked: 'Linked {from} → {to}',
  linkRemoved: 'Dependency removed',
  cancelled: 'Cancelled',
  linkChanged: 'Dependency changed',
  taskRemoved: '{title}, removed',
  undone: 'Undone: {change}',
  redone: 'Redone: {change}',
  pushed: '{task}; {count} more pushed later',
  broken: '{task}; {count} dependencies not kept',
  scheduled: 'Rescheduled, {count} tasks moved',
  newTask: 'New task',
  addRow: 'Add a task',
  taskAdded: 'Added {title}',
  movedUnder: '{task} moved under {parent}',
  movedTop: '{task} moved to the top level',
  invalidValue: '{column} not valid, nothing changed',
  tasksRemoved: 'Removed {titles}',
  listSeparator: ', ',
  editCell: 'Edit {column}',
  menu: {
    rename: 'Rename',
    addAfter: 'Add task below',
    addInside: 'Add subtask',
    addTask: 'Add task',
    indent: 'Indent',
    outdent: 'Outdent',
    removeTask: 'Delete task',
    removeTasks: 'Delete {count} tasks',
    removeLink: 'Delete dependency',
  },
  criticalTask: '{task}, critical',
  scheduler: {
    name: 'Scheduler',
    resource: 'Resource',
    unassigned: 'Unassigned',
    keys: 'Arrow keys move between tasks, Alt with left or right changes the time, Alt with up or down changes the resource, the menu key opens the menu, Delete removes, Mod+Z undoes',
    task: '{title}, {start} to {end}, {duration}',
    item: '{task}, {resource}',
    row: '{title}, {count} tasks',
    overloaded: '{row}, takes more than it can at times',
    overloadHint: 'Takes more than it can at times',
    moved: '{title} moved to {resource}',
  },
}

export const ganttLocales: Record<string, GanttMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/** Texts to change; nested groups are merged, so only the ones given are replaced. */
export type GanttMessagesOverride = {
  [K in keyof GanttMessages]?: GanttMessages[K] extends string
    ? string
    : GanttMessages[K] extends unknown[]
      ? GanttMessages[K]
      : Partial<GanttMessages[K]>
}

/**
 * The Gantt chart's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function useGanttMessages(override?: MaybeRefOrGetter<GanttMessagesOverride | undefined>) {
  const { locale } = useLocale()
  return computed<GanttMessages>(() => {
    const name = locale.value.name
    const base =
      ganttLocales[name] ?? ganttLocales[name.split('-')[0]!] ?? (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    if (!extra) return base
    const out = { ...base } as Record<string, unknown>
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined) continue
      const own = out[key]
      out[key] =
        typeof own === 'object' && own && !Array.isArray(own)
          ? { ...own, ...(value as object) }
          : value
    }
    return out as unknown as GanttMessages
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
