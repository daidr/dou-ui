import { h, render } from 'vue'
import type { App } from 'vue'
import { installedAppContext, setInstalledAppContext } from '../../utils/app-context'
import { withInstall } from '../../utils/install'
import { addToast, clearToasts, removeToast, toastState, updateToast } from './store'
import ToastViewport from './toast-viewport.vue'
import type {
  ToastHandle,
  ToastOptions,
  ToastPromiseMessages,
  ToastPromiseState,
  ToastTone,
} from './toast'

export const DouToastViewport = withInstall(ToastViewport)
const installViewport = DouToastViewport.install
// Installing the viewport also lets `toast()` borrow the app's config.
DouToastViewport.install = (app: App) => {
  installViewport?.(app)
  // oxlint-disable-next-line no-underscore-dangle -- the public way to reach an app's context
  setInstalledAppContext(app._context)
}

function ensureViewport() {
  if (toastState.viewports.length > 0 || typeof document === 'undefined') return
  const container = document.createElement('div')
  const vnode = h(ToastViewport)
  vnode.appContext = installedAppContext()
  render(vnode, container)
}

type ToastInput = string | ToastOptions
type ToastExtra = Omit<ToastOptions, 'message'>

function show(input: ToastInput, extra?: ToastExtra, tone?: ToastTone): ToastHandle {
  const options = typeof input === 'string' ? { ...extra, message: input } : { ...input }
  if (tone) options.tone = tone
  ensureViewport()
  const { id } = addToast(options)
  return {
    id,
    close: () => removeToast(id),
    update: (next) => updateToast(id, typeof next === 'string' ? { message: next } : next),
  }
}

const settle = <T>(state: ToastPromiseState<T>, value: T): Partial<ToastOptions> => {
  const result = typeof state === 'function' ? state(value) : state
  return typeof result === 'string' ? { message: result } : result
}

function promise<T>(
  task: Promise<T> | (() => Promise<T>),
  messages: ToastPromiseMessages<T>,
  options?: ToastExtra,
): Promise<T> {
  const handle = show(messages.loading, { ...options, loading: true })
  const running = typeof task === 'function' ? task() : task
  running.then(
    (value) => handle.update({ tone: 'success', ...settle(messages.success, value) }),
    (error: unknown) => handle.update({ tone: 'danger', ...settle(messages.error, error) }),
  )
  return running
}

export interface ToastApi {
  (input: ToastInput, options?: ToastExtra): ToastHandle
  success: (input: ToastInput, options?: ToastExtra) => ToastHandle
  warning: (input: ToastInput, options?: ToastExtra) => ToastHandle
  danger: (input: ToastInput, options?: ToastExtra) => ToastHandle
  /** A toast with a spinner that stays until it is updated or closed. */
  loading: (input: ToastInput, options?: ToastExtra) => ToastHandle
  /**
   * Show `loading` while the promise runs, then turn the same toast into
   * `success` or `error`. Returns the promise, so the caller can still
   * await it and handle the error.
   */
  promise: <T>(
    task: Promise<T> | (() => Promise<T>),
    messages: ToastPromiseMessages<T>,
    options?: ToastExtra,
  ) => Promise<T>
  /** Change a toast in place by id; see `ToastHandle.update`. */
  update: (id: number, input: string | Partial<ToastOptions>) => void
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
 * toast.promise(save(), { loading: '保存中…', success: '已保存', error: '保存失败' })
 * ```
 */
export const toast: ToastApi = Object.assign(
  (input: ToastInput, options?: ToastExtra) => show(input, options),
  {
    success: (input: ToastInput, options?: ToastExtra) => show(input, options, 'success'),
    warning: (input: ToastInput, options?: ToastExtra) => show(input, options, 'warning'),
    danger: (input: ToastInput, options?: ToastExtra) => show(input, options, 'danger'),
    loading: (input: ToastInput, options?: ToastExtra) =>
      show(input, { ...options, loading: true }),
    promise,
    update: (id: number, input: string | Partial<ToastOptions>) =>
      updateToast(id, typeof input === 'string' ? { message: input } : input),
    close: removeToast,
    closeAll: clearToasts,
  },
)

export type * from './toast'
export type ToastViewportInstance = InstanceType<typeof ToastViewport>

declare module 'vue' {
  export interface GlobalComponents {
    DouToastViewport: typeof DouToastViewport
  }
}
