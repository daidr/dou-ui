import { TablePivotIcon } from '@dou-ui/icons'
import type { PivotField } from '@dou-ui/pivot'
import { defineComponent, h } from 'vue'
import { defineDashboardWidget } from '../widget/define'
import type { WidgetOverrides } from '../widgets'
import Pivot from './pivot.vue'
import PivotSettings from './pivot-settings.vue'
import type { PivotWidgetProps } from './types'

export type { PivotWidgetProps } from './types'

export interface PivotWidgetOptions extends WidgetOverrides<PivotWidgetProps> {
  /** What the fields hold and how to show them, as `DouPivot`'s `fields`; worked out from the records when left out. */
  fields?: readonly PivotField[]
}

/**
 * A pivot table of a source's records, drawn with `@dou-ui/pivot`; its
 * settings lay the fields out, and clicking a cell can filter the other
 * widgets. Needs `@dou-ui/pivot` and its styles.
 */
export function pivotWidget(options: PivotWidgetOptions = {}) {
  const { fields, ...overrides } = options
  return defineDashboardWidget<PivotWidgetProps>({
    type: 'pivot',
    label: '透视表',
    icon: TablePivotIcon,
    size: { w: 6, h: 5, minW: 4, minH: 3 },
    defaultProps: { config: {} },
    component: defineComponent({
      name: 'DouDashboardPivot',
      setup: () => () => h(Pivot, { fields }),
    }),
    settings: defineComponent({
      name: 'DouDashboardPivotSettingsFor',
      props: { modelValue: { type: Object, required: true } },
      emits: ['update:modelValue'],
      setup:
        (props, { emit }) =>
        () =>
          h(PivotSettings, {
            fields,
            modelValue: props.modelValue as PivotWidgetProps,
            'onUpdate:modelValue': (value: PivotWidgetProps) => emit('update:modelValue', value),
          }),
    }),
    ...overrides,
  })
}
