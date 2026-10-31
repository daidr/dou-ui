import { defineDashboardWidget } from '../widget/define'
import type { WidgetOverrides } from '../widgets'
import Chart from './chart.vue'
import ChartSettings from './chart-settings.vue'
import type { ChartWidgetProps } from './types'

export type { ChartWidgetProps } from './types'

/**
 * A chart of a source's rows (line, area, bar or pie), drawn with
 * `@dou-ui/chart`; clicking an x can filter the other widgets. Needs
 * `@dou-ui/chart` and its styles.
 */
export function chartWidget(overrides: WidgetOverrides<ChartWidgetProps> = {}) {
  return defineDashboardWidget<ChartWidgetProps>({
    type: 'chart',
    label: '图表',
    size: { w: 6, h: 4, minW: 3, minH: 3 },
    defaultProps: { kind: 'line', y: [] },
    component: Chart,
    settings: ChartSettings,
    ...overrides,
  })
}
