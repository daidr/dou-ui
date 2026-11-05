import type { AppContext } from 'vue'

let installed: AppContext | null = null

/** Remembers the app `app.use(DouUI)` was called on. */
export function setInstalledAppContext(appContext: AppContext | null) {
  installed = appContext
}

/**
 * The context of the app DouUI was installed in, for things rendered outside
 * any component (e.g. by a function) to take its locale and config; `null`
 * before `app.use(DouUI)`.
 */
export function installedAppContext() {
  return installed
}
