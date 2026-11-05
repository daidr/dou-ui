import type { AppContext } from 'vue'

let installed: AppContext | null = null

/**
 * Remembers the app whose locale and config what is rendered outside any
 * component should take. `app.use(DouUI)`, installing `DouDialog` or
 * `DouToastViewport`, and `provideGlobalConfig(config, app)` call it; the
 * last one wins. Call it yourself to pick one of several apps.
 */
export function setInstalledAppContext(appContext: AppContext | null) {
  installed = appContext
}

/**
 * The context of the app DouUI was set up in (see `setInstalledAppContext`),
 * for things rendered outside any component, e.g. by `dialog()`, `toast()`
 * or `renderFlowSVG`, to take its locale and config; `null` before.
 */
export function installedAppContext() {
  return installed
}
