import { defineDashboardWidget } from '@dou-ui/dashboard'
import SalesBars from './sales-bars.vue'
import SalesMetric from './sales-metric.vue'
import SalesTrend from './sales-trend.vue'

export const salesWidgets = [
  defineDashboardWidget({
    type: 'metric',
    label: '指标',
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    defaultProps: { source: 'summary', field: 'amount' },
    component: SalesMetric,
    fullscreen: false,
  }),
  defineDashboardWidget({
    type: 'trend',
    label: '趋势',
    size: { w: 6, h: 2, minW: 3, minH: 2 },
    defaultProps: { source: 'trend' },
    component: SalesTrend,
  }),
  defineDashboardWidget({
    type: 'bars',
    label: '排行',
    size: { w: 6, h: 4, minW: 3, minH: 3 },
    defaultProps: { source: 'region', filter: 'region' },
    component: SalesBars,
  }),
]
