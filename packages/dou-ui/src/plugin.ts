import type { App, Plugin } from 'vue'
import { DouButton } from './components'

const components: Plugin[] = [DouButton]

/**
 * Register every component globally.
 *
 * ```ts
 * import DouUI from 'dou-ui'
 * import 'dou-ui/style.css'
 *
 * app.use(DouUI)
 * ```
 *
 * Prefer importing components individually when bundle size matters.
 */
export const DouUI: Plugin = {
  install(app: App) {
    for (const component of components) app.use(component)
  },
}
