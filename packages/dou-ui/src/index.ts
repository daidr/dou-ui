import { DouUI } from './plugin'

export * from './components'
export * from './locale'
export {
  computePosition,
  getTabbable,
  isTopLayer,
  useFloating,
  useFocusTrap,
  useLayer,
  useScrollLock,
} from './composables'
export type {
  Layer,
  Placement,
  Position,
  PositionOptions,
  Side,
  UseFloatingOptions,
  UseFocusTrapOptions,
  UseLayerOptions,
  VirtualElement,
} from './composables'
export {
  getMotionDuration,
  setMotionMode,
  useMotionMode,
  useReducedMotion,
} from './composables/use-motion'
export type { MotionDuration, MotionMode } from './composables/use-motion'
export {
  formatHotkey,
  isApplePlatform,
  matchesHotkey,
  parseHotkey,
  useApplePlatform,
  useHotkey,
} from './composables/use-hotkey'
export type { UseHotkeyOptions } from './composables/use-hotkey'
export { breakpointWidth, useBreakpoints } from './composables/use-breakpoints'
export type { UseBreakpointsReturn } from './composables/use-breakpoints'
export { useClipboard } from './composables/use-clipboard'
export type { UseClipboardOptions, UseClipboardReturn } from './composables/use-clipboard'
export { useRovingFocus } from './composables/use-roving-focus'
export type { RovingOrientation, UseRovingFocusOptions } from './composables/use-roving-focus'
export { breakpoints } from '@dou-ui/theme'
export type { Breakpoint } from '@dou-ui/theme'
export { useNamespace, withInstall } from './utils'
export type { Size, Tone, WithInstall } from './utils'
export { DouUI }
export default DouUI
