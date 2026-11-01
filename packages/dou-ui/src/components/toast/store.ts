import { reactive } from 'vue'
import type { AppContext } from 'vue'
import type { ToastOptions, ToastRecord } from './toast'

export const toastState = reactive({
  items: [] as ToastRecord[],
  /** Viewports currently mounted, by the app or automatically. The last one shows the toasts. */
  viewports: [] as number[],
})

let seed = 0
let viewportSeed = 0

export const nextViewportId = () => ++viewportSeed
let context: AppContext | null = null

/** Remember the app whose config (locale, z-index) toasts shown by `toast()` should use. */
export function setToastContext(appContext: AppContext | null) {
  context = appContext
}

export function getToastContext() {
  return context
}

const defaultDuration = (options: Partial<ToastOptions>) =>
  options.loading ? 0 : options.action ? 6000 : 3000

export function addToast(options: ToastOptions): ToastRecord {
  const record: ToastRecord = {
    id: ++seed,
    message: options.message,
    title: options.title,
    tone: options.tone ?? 'neutral',
    duration: options.duration ?? defaultDuration(options),
    closable: options.closable ?? false,
    placement: options.placement ?? 'top',
    loading: options.loading ?? false,
    action: options.action,
    onClose: options.onClose,
    version: 0,
  }
  toastState.items.push(record)
  return record
}

/**
 * Change a toast in place. The fields not given keep their values, except
 * `loading`, which ends; a toast that stops loading takes the default
 * duration unless one is given.
 */
export function updateToast(id: number, patch: Partial<ToastOptions>) {
  const record = toastState.items.find((item) => item.id === id)
  if (!record) return
  const loading = patch.loading ?? false
  const duration =
    patch.duration ??
    (record.loading !== loading
      ? defaultDuration({ ...record, ...patch, loading })
      : record.duration)
  Object.assign(record, { ...patch, loading, duration, version: record.version + 1 })
}

export function removeToast(id: number) {
  const index = toastState.items.findIndex((item) => item.id === id)
  if (index < 0) return
  const [record] = toastState.items.splice(index, 1)
  record?.onClose?.()
}

export function clearToasts() {
  // Copy first: removing shrinks the list being walked.
  for (const item of toastState.items.slice()) removeToast(item.id)
}
