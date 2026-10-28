import type { App, Plugin } from 'vue'
import {
  DouAlert,
  DouAvatar,
  DouAvatarGroup,
  DouBadge,
  DouBreadcrumb,
  DouButton,
  DouCard,
  DouCheckbox,
  DouCalendar,
  DouCheckboxGroup,
  DouCommand,
  DouCommandDialog,
  DouConfigProvider,
  DouDatePicker,
  DouDescriptions,
  DouDescriptionsItem,
  DouDialog,
  DouDivider,
  DouDrawer,
  DouDropdown,
  DouDropdownItem,
  DouEmpty,
  DouForm,
  DouFormItem,
  DouIcon,
  DouInput,
  DouInputNumber,
  DouKbd,
  DouLink,
  DouPagination,
  DouPopover,
  DouProgress,
  DouRadio,
  DouRadioGroup,
  DouSegmentedControl,
  DouSelect,
  DouSkeleton,
  DouSlider,
  DouSpace,
  DouSpinner,
  DouSwitch,
  DouTabPanel,
  DouTable,
  DouTabs,
  DouTag,
  DouText,
  DouTextarea,
  DouToastViewport,
  DouTooltip,
  DouTree,
  DouUpload,
  DouVirtualList,
} from './components'
import { provideGlobalConfig } from './components/config-provider/use-config'
import type { GlobalConfig } from './components/config-provider/config-provider'

const components: Plugin[] = [
  DouAlert,
  DouAvatar,
  DouAvatarGroup,
  DouBadge,
  DouBreadcrumb,
  DouButton,
  DouCard,
  DouCheckbox,
  DouCalendar,
  DouCheckboxGroup,
  DouCommand,
  DouCommandDialog,
  DouConfigProvider,
  DouDatePicker,
  DouDescriptions,
  DouDescriptionsItem,
  DouDialog,
  DouDivider,
  DouDrawer,
  DouDropdown,
  DouDropdownItem,
  DouEmpty,
  DouForm,
  DouFormItem,
  DouIcon,
  DouInput,
  DouInputNumber,
  DouKbd,
  DouLink,
  DouPagination,
  DouPopover,
  DouProgress,
  DouRadio,
  DouRadioGroup,
  DouSegmentedControl,
  DouSelect,
  DouSkeleton,
  DouSlider,
  DouSpace,
  DouSpinner,
  DouSwitch,
  DouTabPanel,
  DouTable,
  DouTabs,
  DouTag,
  DouText,
  DouTextarea,
  DouToastViewport,
  DouTooltip,
  DouTree,
  DouUpload,
  DouVirtualList,
]

/**
 * Register every component globally.
 *
 * ```ts
 * import DouUI from 'dou-ui'
 * import 'dou-ui/style.css'
 *
 * app.use(DouUI)
 * // or with app-wide defaults
 * app.use(DouUI, { size: 'sm', locale: en })
 * ```
 *
 * Prefer importing components individually when bundle size matters.
 */
export const DouUI: Plugin<[GlobalConfig?]> = {
  install(app: App, config?: GlobalConfig) {
    for (const component of components) app.use(component)
    if (config) provideGlobalConfig(config, app)
  },
}
