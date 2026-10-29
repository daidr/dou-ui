import { computed, effectScope, readonly, ref, watch } from 'vue'
import type { Ref, WritableComputedRef } from 'vue'
import type { ColorMode, ResolvedColorMode, UseColorModeOptions } from './color-mode'

export interface UseColorModeReturn {
  /** What the user picked. Assign to change it; the choice is remembered. */
  mode: Ref<ColorMode>
  /** The mode the page is painted in, with `system` resolved. */
  resolved: Readonly<Ref<ResolvedColorMode>>
  /** What the system prefers. */
  system: Readonly<Ref<ResolvedColorMode>>
  /** Whether the page is dark. Assigning picks `dark` or `light` explicitly. */
  isDark: WritableComputedRef<boolean>
}

const DEFAULTS = {
  storageKey: 'dou-color-mode',
  initial: 'system',
  target: 'html',
  disableTransition: true,
} satisfies Required<UseColorModeOptions>

const MODES: readonly ColorMode[] = ['light', 'dark', 'system']
const isMode = (value: unknown): value is ColorMode => MODES.includes(value as ColorMode)

let shared: UseColorModeReturn | undefined

/**
 * The page's color mode: light, dark, or following the system.
 *
 * The page shares one state, so every caller and every color mode
 * component sees the same mode. The options of the first call apply;
 * call it once near the root with your options, then anywhere without.
 * It writes `data-dou-theme` on `<html>` and keeps it up to date, also
 * when the choice changes in another tab.
 *
 * On the server it returns a fresh state at `initial` and touches nothing.
 * Pair it with `colorModeScript()` in `<head>` so the first paint is
 * already in the right mode.
 */
export function useColorMode(options: UseColorModeOptions = {}): UseColorModeReturn {
  if (typeof window === 'undefined') return create(options, false)
  // Detached, so the state outlives the component that happened to create it.
  shared ??= effectScope(true).run(() => create(options, true))!
  return shared
}

function create(options: UseColorModeOptions, browser: boolean): UseColorModeReturn {
  const { storageKey, initial, target, disableTransition } = { ...DEFAULTS, ...options }

  const mode = ref<ColorMode>(browser ? (read(storageKey) ?? initial) : initial)
  const system = ref<ResolvedColorMode>('light')
  const resolved = computed<ResolvedColorMode>(() =>
    mode.value === 'system' ? system.value : mode.value,
  )
  const isDark = computed({
    get: () => resolved.value === 'dark',
    set: (dark: boolean) => {
      mode.value = dark ? 'dark' : 'light'
    },
  })
  const state = { mode, resolved: readonly(resolved), system: readonly(system), isDark }
  if (!browser) return state

  const query = window.matchMedia?.('(prefers-color-scheme: dark)')
  const sync = () => {
    system.value = query?.matches ? 'dark' : 'light'
  }
  sync()
  query?.addEventListener?.('change', sync)

  if (storageKey) {
    window.addEventListener('storage', (event) => {
      if (event.key !== storageKey) return
      mode.value = isMode(event.newValue) ? event.newValue : initial
    })
  }

  watch(mode, (value) => write(storageKey, value))
  watch(
    resolved,
    (value) => {
      const element = typeof target === 'string' ? document.querySelector(target) : target
      if (!(element instanceof HTMLElement)) return
      const restore = disableTransition ? pauseTransitions() : undefined
      element.dataset.douTheme = value
      element.style.colorScheme = value
      restore?.()
    },
    { immediate: true },
  )
  return state
}

function read(key: string | false): ColorMode | undefined {
  if (!key) return undefined
  try {
    const value = localStorage.getItem(key)
    return isMode(value) ? value : undefined
  } catch {
    return undefined
  }
}

function write(key: string | false, value: ColorMode) {
  if (!key) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be off, e.g. in a private window; the mode still applies.
  }
}

/** Stop every transition until the new colors are painted, then let them run again. */
function pauseTransitions() {
  const style = document.createElement('style')
  style.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.append(style)
  return () => {
    // Reading a computed style forces the new colors to apply before the rule goes.
    void getComputedStyle(document.body).opacity
    requestAnimationFrame(() => style.remove())
  }
}

/**
 * A script for `<head>` that applies the remembered mode before the first
 * paint, so a dark page does not flash light. Pass the same options as
 * to `useColorMode()`.
 *
 * ```ts
 * useHead({ script: [{ innerHTML: colorModeScript() }] })
 * ```
 */
export function colorModeScript(options: Omit<UseColorModeOptions, 'disableTransition'> = {}) {
  const { storageKey, initial, target } = { ...DEFAULTS, ...options }
  const selector = typeof target === 'string' ? target : 'html'
  return `;(() => {
  let mode = ${JSON.stringify(initial)}
  try { mode = ${storageKey ? `localStorage.getItem(${JSON.stringify(storageKey)}) || mode` : 'mode'} } catch {}
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const element = document.querySelector(${JSON.stringify(selector)})
  if (element) {
    element.dataset.douTheme = dark ? 'dark' : 'light'
    element.style.colorScheme = dark ? 'dark' : 'light'
  }
})()`
}

/** Forget the shared state. For tests. */
export function resetColorMode() {
  shared = undefined
}
