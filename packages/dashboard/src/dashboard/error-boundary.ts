import { nextTick, onErrorCaptured, ref, watch } from 'vue'
import type { Ref } from 'vue'

// Vue names where an error came from: in words while developing, as a code in
// production (`https://vuejs.org/error-reference/#runtime-<code>`)
const REFERENCE = 'https://vuejs.org/error-reference/#runtime-'
/** Setting up, rendering, updating, and the hooks around mounting: the part's view is broken. */
const VIEW_CODES = new Set(['sp', 'bc', 'c', 'bm', 'm', 'bu', 'u', '0', '1', '13', '15'])
const VIEW_NAMES = new Set([
  'serverPrefetch hook',
  'beforeCreate hook',
  'created hook',
  'beforeMount hook',
  'mounted hook',
  'beforeUpdate hook',
  'updated',
  'setup function',
  'render function',
  'async component loader',
  'component update',
])

/**
 * Whether an error broke what a component shows. Errors in event handlers,
 * watchers and the like leave it showing: they go on to the app as usual.
 */
export function breaksView(info: string): boolean {
  return info.startsWith(REFERENCE)
    ? VIEW_CODES.has(info.slice(REFERENCE.length))
    : VIEW_NAMES.has(info)
}

/**
 * Keeps an error that breaks a widget's content or settings in that part:
 * `failed` turns on, `report` is told, and the error goes no further. The
 * caller shows the error state and turns `failed` off to try again.
 */
export function useErrorBoundary(
  label: () => string,
  report: (error: unknown) => void,
): Ref<boolean> {
  const failed = ref(false)
  // trying again often fails the same way, e.g. when the first data arrives:
  // that is told once, until the part shows again
  let last: string | undefined
  watch(failed, (on) => {
    if (!on) nextTick(() => !failed.value && (last = undefined))
  })
  onErrorCaptured((error, _instance, info) => {
    if (!breaksView(info)) return
    failed.value = true
    const key = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    if (key !== last) {
      last = key
      if (process.env.NODE_ENV !== 'production')
        console.error(`[@dou-ui/dashboard] ${label()} failed:`, error)
      report(error)
    }
    return false
  })
  return failed
}
