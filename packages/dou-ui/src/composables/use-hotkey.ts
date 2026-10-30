import { onMounted, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { isComposing } from '../utils/keyboard'

/*
 * A hotkey is written as keys joined by `+`, e.g. `mod+k` or `shift+/`. A
 * space separates the steps of a sequence, e.g. `g i`. `mod` is ⌘ on Apple
 * platforms and Ctrl elsewhere. Case does not matter.
 */

export interface UseHotkeyOptions {
  /** Where to listen. Defaults to the document. */
  target?: MaybeRefOrGetter<EventTarget | null | undefined>
  /** Turn the hotkey off without unbinding it. Defaults to `true`. */
  enabled?: MaybeRefOrGetter<boolean>
  /** Also fire while typing in an input, textarea, select or editable element. */
  allowInInput?: boolean
  /** Call `preventDefault` on the matching key press. Defaults to `true`. */
  preventDefault?: boolean
  /** How long to wait for the next step of a sequence, in ms. Defaults to 1000. */
  sequenceTimeout?: number
}

interface Combo {
  key: string
  meta: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
}

const ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  option: 'alt',
}

const MODIFIERS = ['mod', 'meta', 'ctrl', 'alt', 'shift']

/** Whether the page runs on macOS or iOS, where `mod` means ⌘. */
export function isApplePlatform() {
  if (typeof navigator === 'undefined') return false
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform
  return /mac|iphone|ipad|ipod/i.test(platform)
}

const normalize = (key: string) => ALIASES[key] ?? key

/** Split a hotkey into sequence steps, each a list of normalized keys. */
export function parseHotkey(hotkey: string): string[][] {
  return hotkey
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((step) =>
      // `shift++` and a lone `+` mean the plus key itself
      step
        .replace(/\+\+$/, '+plus')
        .split('+')
        .map((key) => (key === 'plus' ? '+' : normalize(key))),
    )
}

function toCombo(keys: string[], apple: boolean): Combo {
  const modifiers = keys.filter((key) => MODIFIERS.includes(key))
  const key = keys.find((name) => !MODIFIERS.includes(name)) ?? ''
  return {
    key,
    meta: modifiers.includes('meta') || (apple && modifiers.includes('mod')),
    ctrl: modifiers.includes('ctrl') || (!apple && modifiers.includes('mod')),
    alt: modifiers.includes('alt'),
    shift: modifiers.includes('shift'),
  }
}

const PUNCTUATION_CODES: Record<string, string> = {
  '/': 'Slash',
  '.': 'Period',
  ',': 'Comma',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  '-': 'Minus',
  '=': 'Equal',
  '`': 'Backquote',
}

/** The key a press stands for, reading the physical key when Alt or Shift changed the character. */
function keyMatches(event: KeyboardEvent, key: string) {
  if (event.key.toLowerCase() === key) return true
  if (/^[a-z]$/.test(key)) return event.code === `Key${key.toUpperCase()}`
  if (/^\d$/.test(key)) return event.code === `Digit${key}`
  return PUNCTUATION_CODES[key] !== undefined && event.code === PUNCTUATION_CODES[key]
}

function comboMatches(event: KeyboardEvent, combo: Combo) {
  // Shift is implied by characters like `?`, so only check it when asked for
  // or when the key is a letter, where it changes the meaning.
  const checkShift = combo.shift || /^[a-z]$/.test(combo.key) || combo.key.length > 1
  return (
    keyMatches(event, combo.key) &&
    event.metaKey === combo.meta &&
    event.ctrlKey === combo.ctrl &&
    event.altKey === combo.alt &&
    (!checkShift || event.shiftKey === combo.shift)
  )
}

/** Whether a key press matches a single-step hotkey such as `mod+k`. */
export function matchesHotkey(event: KeyboardEvent, hotkey: string, apple = isApplePlatform()) {
  const steps = parseHotkey(hotkey)
  return steps.length === 1 && comboMatches(event, toCombo(steps[0]!, apple))
}

function isTyping(event: KeyboardEvent) {
  const target = (event.composedPath?.()[0] ?? event.target) as HTMLElement | null
  if (!target || !('tagName' in target)) return false
  const tag = target.tagName
  return (
    target.isContentEditable ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (tag === 'INPUT' &&
      !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
        (target as HTMLInputElement).type,
      ))
  )
}

/**
 * Call `handler` when one of `hotkeys` is pressed. Listens on the document
 * unless `target` is given, skips presses while the user types in a field,
 * and unbinds when the calling scope is disposed. Returns a function that
 * unbinds early.
 */
export function useHotkey(
  hotkeys: MaybeRefOrGetter<string | string[] | false | null | undefined>,
  handler: (event: KeyboardEvent, hotkey: string) => void,
  options: UseHotkeyOptions = {},
) {
  const { allowInInput = false, preventDefault = true, sequenceTimeout = 1000 } = options
  /** How far each sequence has got, by hotkey. */
  const progress = new Map<string, number>()
  let timer: ReturnType<typeof setTimeout> | undefined

  function list() {
    const value = toValue(hotkeys)
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }

  function onKeydown(raw: Event) {
    const event = raw as KeyboardEvent
    if (toValue(options.enabled) === false || isComposing(event) || event.key === undefined) return
    // something closer to the target already handled the key, e.g. an editor's own shortcut
    if (event.defaultPrevented) return
    if (!allowInInput && isTyping(event)) return
    // a bare modifier press never moves a sequence on or resets it
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return
    const apple = isApplePlatform()
    let fired: string | undefined
    let waiting = false
    for (const hotkey of list()) {
      const steps = parseHotkey(hotkey).map((step) => toCombo(step, apple))
      if (!steps.length) continue
      let at = progress.get(hotkey) ?? 0
      if (!comboMatches(event, steps[at]!)) at = 0
      if (!comboMatches(event, steps[at]!)) {
        progress.delete(hotkey)
        continue
      }
      if (steps.length > 1 && event.repeat) continue
      if (at + 1 < steps.length) {
        progress.set(hotkey, at + 1)
        waiting = true
        continue
      }
      progress.delete(hotkey)
      fired ??= hotkey
    }
    clearTimeout(timer)
    if (waiting) timer = setTimeout(() => progress.clear(), sequenceTimeout)
    if (fired === undefined) return
    progress.clear()
    if (preventDefault) event.preventDefault()
    handler(event, fired)
  }

  let bound: EventTarget | null = null
  function bind(target: EventTarget | null | undefined) {
    bound?.removeEventListener('keydown', onKeydown)
    bound = target ?? null
    bound?.addEventListener('keydown', onKeydown)
  }

  const stopWatch = watch(
    () => (options.target === undefined ? undefined : toValue(options.target)),
    (target) => {
      if (typeof document === 'undefined') return
      bind(options.target === undefined ? document : target)
    },
    { immediate: true },
  )

  function stop() {
    stopWatch()
    bind(null)
    clearTimeout(timer)
  }
  onScopeDispose(stop)
  return stop
}

const APPLE_LABELS: Record<string, string> = {
  mod: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  enter: '↩',
  backspace: '⌫',
  delete: '⌦',
  tab: '⇥',
}
const OTHER_LABELS: Record<string, string> = {
  mod: 'Ctrl',
  meta: 'Win',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  enter: 'Enter',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
}
const SHARED_LABELS: Record<string, string> = {
  escape: 'Esc',
  ' ': 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
}
/** Apple lists modifiers in a fixed order: ⌃ ⌥ ⇧ ⌘. */
const APPLE_ORDER = ['ctrl', 'alt', 'shift', 'mod', 'meta']

/**
 * The labels to show for a hotkey on this platform: one list of keys per
 * sequence step, e.g. `mod+k` gives `[['⌘', 'K']]` on Apple platforms and
 * `[['Ctrl', 'K']]` elsewhere.
 */
export function formatHotkey(hotkey: string, apple = isApplePlatform()): string[][] {
  return parseHotkey(hotkey).map((step) => {
    const keys = apple
      ? // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
        [...step].sort((a, b) => rank(a) - rank(b))
      : step
    return keys.map(
      (key) =>
        (apple ? APPLE_LABELS[key] : OTHER_LABELS[key]) ??
        SHARED_LABELS[key] ??
        (key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1)),
    )
  })
}
function rank(key: string) {
  const index = APPLE_ORDER.indexOf(key)
  return index < 0 ? APPLE_ORDER.length : index
}

/**
 * Whether the page runs on an Apple platform, as a ref that starts `false`
 * and updates after mounting, so server-rendered markup matches the first
 * client render.
 */
export function useApplePlatform(): Ref<boolean> {
  const apple = ref(false)
  onMounted(() => (apple.value = isApplePlatform()))
  return apple
}
