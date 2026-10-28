import { h, render } from 'vue'
import type { AppContext, Directive } from 'vue'
import LoadingMask from './loading-mask.vue'
import type { LoadingDirectiveValue } from './loading'

interface LoadingState {
  container: HTMLElement
  appContext: AppContext | null
  timer?: ReturnType<typeof setTimeout>
  shown: boolean
  options: DirectiveOptions
}

const states = new WeakMap<HTMLElement, LoadingState>()
const PARENT_CLASS = 'dou-loading-parent'

type DirectiveOptions = Exclude<LoadingDirectiveValue, boolean> & { loading: boolean }

function normalize(value: LoadingDirectiveValue | undefined): DirectiveOptions {
  return typeof value === 'object' && value !== null
    ? { ...value, loading: value.loading ?? true }
    : { loading: !!value }
}

function update(el: HTMLElement, value: LoadingDirectiveValue | undefined) {
  const state = states.get(el)
  if (!state) return
  const options = normalize(value)
  state.options = options

  const show = () => {
    state.timer = undefined
    const { text, size } = state.options
    const vnode = h(LoadingMask, { text, size })
    vnode.appContext = state.appContext
    render(vnode, state.container)
    if (!state.shown) el.append(state.container)
    state.shown = true
    el.classList.add(PARENT_CLASS)
    el.setAttribute('aria-busy', 'true')
  }

  if (options.loading) {
    // A pending delay keeps running; the mask shows the latest options.
    if (state.shown || !options.delay) show()
    else state.timer ??= setTimeout(show, options.delay)
    return
  }
  if (state.timer !== undefined) clearTimeout(state.timer)
  state.timer = undefined
  if (state.shown) {
    render(null, state.container)
    state.container.remove()
    state.shown = false
    el.classList.remove(PARENT_CLASS)
    el.removeAttribute('aria-busy')
  }
}

/**
 * Cover an element with the loading mask.
 *
 * ```vue
 * <DouCard v-loading="saving">…</DouCard>
 * <section v-loading="{ loading: saving, text: '正在保存' }">…</section>
 * ```
 */
export const vLoading: Directive<HTMLElement, LoadingDirectiveValue> = {
  mounted(el, binding) {
    states.set(el, {
      container: document.createElement('div'),
      appContext: binding.instance?.$.appContext ?? null,
      shown: false,
      options: { loading: false },
    })
    update(el, binding.value)
  },
  updated(el, binding) {
    if (binding.value === binding.oldValue) return
    update(el, binding.value)
  },
  beforeUnmount(el) {
    update(el, false)
    states.delete(el)
  },
  // The mask only ever appears in the browser.
  getSSRProps: () => ({}),
}
