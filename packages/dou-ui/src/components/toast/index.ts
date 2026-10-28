import { h, render } from 'vue'
import type { App } from 'vue'
import { withInstall } from '../../utils/install'
import {
  addToast,
  clearToasts,
  getToastContext,
  removeToast,
  setToastContext,
  toastState,
} from './store'
import ToastViewport from './toast-viewport.vue'
import type { ToastHandle, ToastOptions, ToastTone } from './toast'

export const DouToastViewport = withInstall(ToastViewport)
const installViewport = DouToastViewport.install
// Installing the viewport also lets `toast()` borrow the app's config.
DouToastViewport.install = (app: App) => {
  installViewport?.(app)
  // oxlint-disable-next-line no-underscore-dangle -- the public way to reach an app's context
  setToastContext(app._context)
}

function ensureViewport() {
  if (toastState.viewports.length > 0 || typeof document === 'undefined') return
  const container = document.createElement('div')
  const vnode = h(ToastViewport)
  vnode.appContext = getToastContext()
  render(vnode, container)
}

type ToastInput = string | ToastOptions
type ToastExtra = Omit<ToastOptions, 'message'>

function show(input: ToastInput, extra?: ToastExtra, tone?: ToastTone): ToastHandle {
  const options = typeof input === 'string' ? { ...extra, message: input } : { ...input }
  if (tone) options.tone = tone
  ensureViewport()
  const { id } = addToast(options)
  return { id, close: () => removeToast(id) }
}

export interface ToastApi {
  (input: ToastInput, options?: ToastExtra): ToastHandle
  success: (input: ToastInput, options?: ToastExtra) => ToastHandle
  warning: (input: ToastInput, options?: ToastExtra) => ToastHandle
  danger: (input: ToastInput, options?: ToastExtra) => ToastHandle
  /** Close one toast by id. */
  close: (id: number) => void
  closeAll: () => void
}

/**
 * Show a short message that goes away on its own.
 *
 * ```ts
 * toast('已复制')
 * toast.success('部署完成', { title: 'dou-ui.dev' })
 * toast({ message: '已删除', action: { label: '撤销', onClick: undo } })
 * ```
 */
export const toast: ToastApi = Object.assign(
  (input: ToastInput, options?: ToastExtra) => show(input, options),
  {
    success: (input: ToastInput, options?: ToastExtra) => show(input, options, 'success'),
    warning: (input: ToastInput, options?: ToastExtra) => show(input, options, 'warning'),
    danger: (input: ToastInput, options?: ToastExtra) => show(input, options, 'danger'),
    close: removeToast,
    closeAll: clearToasts,
  },
)

export { setToastContext }
export type * from './toast'
export type ToastViewportInstance = InstanceType<typeof ToastViewport>

declare module 'vue' {
  export interface GlobalComponents {
    DouToastViewport: typeof DouToastViewport
  }
}
