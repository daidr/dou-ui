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

export function addToast(options: ToastOptions): ToastRecord {
  const record: ToastRecord = {
    id: ++seed,
    message: options.message,
    title: options.title,
    tone: options.tone ?? 'neutral',
    duration: options.duration ?? (options.action ? 6000 : 3000),
    closable: options.closable ?? false,
    placement: options.placement ?? 'top',
    action: options.action,
    onClose: options.onClose,
  }
  toastState.items.push(record)
  return record
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
