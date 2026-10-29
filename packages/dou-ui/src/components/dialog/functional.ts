import { getCurrentInstance, h, markRaw, render } from 'vue'
import type { AppContext } from 'vue'
import DialogBox from './dialog-box.vue'
import type {
  DialogAlertOptions,
  DialogBoxKind,
  DialogBoxState,
  DialogConfirmOptions,
  DialogHandle,
  DialogPromptOptions,
} from './dialog-api'

let context: AppContext | null = null

/** Remember the app whose config (locale, z-index) dialogs opened by `dialog` should use. */
export function setDialogContext(appContext: AppContext | null) {
  context = appContext
}

const open = new Set<() => void>()
const noop = () => {}

type Input<T> = string | T

function normalize<T extends object>(input: Input<T>, extra?: T): T {
  return typeof input === 'string' ? ({ ...extra, content: input } as T) : { ...input }
}

function show<T>(
  kind: DialogBoxKind,
  options: DialogBoxState,
  answer: (confirmed: boolean, value: string) => T,
  appContext: AppContext | null,
): DialogHandle<T> {
  let close: () => void = noop
  const promise = new Promise<T>((resolve) => {
    // Nothing to show while rendering on the server: answer "cancel".
    if (typeof document === 'undefined') {
      resolve(answer(false, ''))
      return
    }
    const container = document.createElement('div')
    const controller: { close?: () => void } = {}
    const vnode = h(DialogBox, {
      options: markRaw({ ...options, kind }),
      controller,
      onSettle: (confirmed: boolean, value: string) => {
        open.delete(close)
        resolve(answer(confirmed, value))
      },
      onClosed: () => render(null, container),
    })
    vnode.appContext = appContext ?? context
    render(vnode, container)
    close = () => controller.close?.()
    open.add(close)
  })
  return Object.assign(promise, { close: () => close() })
}

export interface DialogApi {
  /** A message with one button. Resolves once it is dismissed. */
  alert: (input: Input<DialogAlertOptions>, options?: DialogAlertOptions) => DialogHandle<void>
  /** A question with "OK" and "Cancel". Resolves to whether it was confirmed. */
  confirm: (
    input: Input<DialogConfirmOptions>,
    options?: DialogConfirmOptions,
  ) => DialogHandle<boolean>
  /** Ask for one line of text. Resolves to the value, or `null` when cancelled. */
  prompt: (
    input: Input<DialogPromptOptions>,
    options?: DialogPromptOptions,
  ) => DialogHandle<string | null>
  /** Close every open dialog as if "cancel" had been pressed. */
  closeAll: () => void
}

function createDialogApi(appContext: AppContext | null): DialogApi {
  return {
    alert: (input, extra) =>
      show('alert', normalize(input, extra) as DialogBoxState, () => undefined, appContext),
    confirm: (input, extra) =>
      show('confirm', normalize(input, extra) as DialogBoxState, (ok) => ok, appContext),
    prompt: (input, extra) =>
      show(
        'prompt',
        normalize(input, extra) as DialogBoxState,
        (ok, value) => (ok ? value : null),
        appContext,
      ),
    closeAll: () => {
      // Deleting the entry being visited is safe while iterating a Set.
      for (const close of open) close()
    },
  }
}

/**
 * Ask a quick question without a template.
 *
 * ```ts
 * if (await dialog.confirm({ title: '删除项目？', content: '此操作无法撤销。', tone: 'danger' })) {
 *   await remove()
 * }
 * const name = await dialog.prompt({ title: '重命名', defaultValue: 'dou-ui' })
 * ```
 *
 * Dialogs take the config (locale, z-index) of the app DouUI was installed
 * in. Inside a component, `useDialog()` uses that component's app instead.
 */
export const dialog: DialogApi = createDialogApi(null)

/** `dialog`, bound to the app of the component that calls it. */
export function useDialog(): DialogApi {
  return createDialogApi(getCurrentInstance()?.appContext ?? null)
}
