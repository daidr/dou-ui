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
  /** How to use the chart with keys; read out when it gets focus. */
  keys: string
  /** Read out: linking by keys (`{title}` is where it starts), what was done. */
  linkMode: string
  linked: string
  linkRemoved: string
  cancelled: string
  undone: string
  redone: string
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
  keys: '上下键选择任务，左右键收起或展开，空格选中；Alt 加左右键移动任务，Alt 加 Shift 加左右键调整结束时间；L 添加依赖',
  linkMode: '从“{title}”添加依赖：上下键选择后续任务，Enter 确认，Esc 取消',
  linked: '已添加依赖：{from} → {to}',
  linkRemoved: '已删除依赖',
  cancelled: '已取消',
  undone: '已撤销',
  redone: '已重做',
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
  keys: '上下鍵選擇任務，左右鍵收合或展開，空白鍵選取；Alt 加左右鍵移動任務，Alt 加 Shift 加左右鍵調整結束時間；L 新增相依',
  linkMode: '從「{title}」新增相依：上下鍵選擇後續任務，Enter 確認，Esc 取消',
  linked: '已新增相依：{from} → {to}',
  linkRemoved: '已刪除相依',
  cancelled: '已取消',
  undone: '已復原',
  redone: '已重做',
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
  keys: 'Up and Down pick a task, Left and Right fold, Space selects; Alt with Left or Right moves the task, Alt with Shift and Left or Right changes its end; L adds a dependency',
  linkMode:
    'Adding a dependency from “{title}”: pick the next task with Up and Down, Enter to confirm, Escape to cancel',
  linked: 'Linked {from} → {to}',
  linkRemoved: 'Dependency removed',
  cancelled: 'Cancelled',
  undone: 'Undone',
  redone: 'Redone',
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
