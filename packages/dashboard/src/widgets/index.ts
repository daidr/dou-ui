import { HashIcon, TableIcon, TypeIcon } from '@dou-ui/icons'
import { defineDashboardWidget } from '../widget/define'
import type { DashboardWidgetType } from '../widget/define'
import Stat from './stat.vue'
import StatSettings from './stat-settings.vue'
import Table from './table.vue'
import TableSettings from './table-settings.vue'
import Text from './text.vue'
import TextSettings from './text-settings.vue'
import type { StatWidgetProps, TableWidgetProps, TextWidgetProps } from './types'

export type { StatWidgetProps, TableWidgetColumn, TableWidgetProps, TextWidgetProps } from './types'
export {
  fieldsOf,
  filterValueOf,
  flagOf,
  numberFieldsOf,
  numberOf,
  recordOf,
  rowsOf,
  textOf,
  textsOf,
  valueAt,
} from './shared'

/** What a built-in widget's definition can change: its type, label, icon, size and more. */
export type WidgetOverrides<P extends object> = Partial<Omit<DashboardWidgetType<P>, 'component'>>

/**
 * A number, read from a source or given, with its change since the last
 * period and a sparkline under it.
 */
export function statWidget(overrides: WidgetOverrides<StatWidgetProps> = {}) {
  return defineDashboardWidget<StatWidgetProps>({
    type: 'stat',
    label: '统计数字',
    icon: HashIcon,
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    defaultProps: { value: 0 },
    component: Stat,
    settings: StatSettings,
    fullscreen: false,
    ...overrides,
  })
}

/** A note: plain text in three sizes, its line breaks kept. */
export function textWidget(overrides: WidgetOverrides<TextWidgetProps> = {}) {
  return defineDashboardWidget<TextWidgetProps>({
    type: 'text',
    label: '文字',
    icon: TypeIcon,
    size: { w: 4, h: 2, minW: 2, minH: 1 },
    defaultProps: { text: '', size: 'md' },
    component: Text,
    settings: TextSettings,
    fullscreen: false,
    ...overrides,
  })
}

/** A source's rows in a table, with the columns picked in its settings. */
export function tableWidget(overrides: WidgetOverrides<TableWidgetProps> = {}) {
  return defineDashboardWidget<TableWidgetProps>({
    type: 'table',
    label: '表格',
    icon: TableIcon,
    size: { w: 6, h: 4, minW: 3, minH: 3 },
    component: Table,
    settings: TableSettings,
    ...overrides,
  })
}
