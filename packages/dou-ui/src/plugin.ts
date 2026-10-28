import type { App, Plugin } from 'vue'
import {
  DouAlert,
  DouButton,
  DouCheckbox,
  DouCheckboxGroup,
  DouConfigProvider,
  DouDialog,
  DouDivider,
  DouDrawer,
  DouDropdown,
  DouDropdownItem,
  DouForm,
  DouFormItem,
  DouIcon,
  DouInput,
  DouInputNumber,
  DouLink,
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
  DouTag,
  DouText,
  DouTextarea,
  DouToastViewport,
  DouTooltip,
} from './components'
import { provideGlobalConfig } from './components/config-provider/use-config'
import type { GlobalConfig } from './components/config-provider/config-provider'

const components: Plugin[] = [
  DouAlert,
  DouButton,
  DouCheckbox,
  DouCheckboxGroup,
  DouConfigProvider,
  DouDialog,
  DouDivider,
  DouDrawer,
  DouDropdown,
  DouDropdownItem,
  DouForm,
  DouFormItem,
  DouIcon,
  DouInput,
  DouInputNumber,
  DouLink,
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
  DouTag,
  DouText,
  DouTextarea,
  DouToastViewport,
  DouTooltip,
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
