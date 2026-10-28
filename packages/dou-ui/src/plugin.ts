import type { App, Plugin } from 'vue'
import {
  DouButton,
  DouCheckbox,
  DouCheckboxGroup,
  DouConfigProvider,
  DouDivider,
  DouForm,
  DouFormItem,
  DouIcon,
  DouInput,
  DouLink,
  DouRadio,
  DouRadioGroup,
  DouSpace,
  DouSwitch,
  DouTag,
  DouText,
} from './components'
import { provideGlobalConfig } from './components/config-provider/use-config'
import type { GlobalConfig } from './components/config-provider/config-provider'

const components: Plugin[] = [
  DouButton,
  DouCheckbox,
  DouCheckboxGroup,
  DouConfigProvider,
  DouDivider,
  DouForm,
  DouFormItem,
  DouIcon,
  DouInput,
  DouLink,
  DouRadio,
  DouRadioGroup,
  DouSpace,
  DouSwitch,
  DouTag,
  DouText,
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
