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
export { useNamespace, withInstall } from './utils'
export type { Size, Tone, WithInstall } from './utils'
export { DouUI }
export default DouUI
