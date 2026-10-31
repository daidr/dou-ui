import { defineDashboardWidget } from '@dou-ui/dashboard'
import { ActivityIcon, LineChartIcon, StickyNoteIcon } from '@dou-ui/icons'
import NoteSettings from './note-settings.vue'
import NoteWidget from './note-widget.vue'
import StatSettings from './stat-settings.vue'
import StatWidget from './stat-widget.vue'
import TrendWidget from './trend-widget.vue'

export const widgets = [
  defineDashboardWidget({
    type: 'stat',
    label: '统计数字',
    icon: ActivityIcon,
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    defaultProps: { value: 0, suffix: '' },
    component: StatWidget,
    settings: StatSettings,
    fullscreen: false,
  }),
  defineDashboardWidget({
    type: 'trend',
    label: '趋势',
    icon: LineChartIcon,
    size: { w: 6, h: 3, minW: 3, minH: 2 },
    defaultProps: { points: [12, 18, 15, 22, 28, 24, 31, 36, 33, 40] },
    component: TrendWidget,
  }),
  defineDashboardWidget({
    type: 'note',
    label: '便签',
    icon: StickyNoteIcon,
    size: { w: 3, h: 3, minH: 2 },
    defaultProps: { text: '' },
    component: NoteWidget,
    settings: NoteSettings,
  }),
]
