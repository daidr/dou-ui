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
export { useElementSize, useIntersection, useResizeObserver } from './composables/use-element-size'
export type {
  UseElementSizeOptions,
  UseIntersectionOptions,
  UseResizeObserverOptions,
} from './composables/use-element-size'
export {
  getMotionDuration,
  setMotionMode,
  useMotionMode,
  useReducedMotion,
} from './composables/use-motion'
export type { MotionDuration, MotionMode } from './composables/use-motion'
export {
  ariaHotkey,
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
export { useNow } from './composables/use-now'
export type { UseNowOptions } from './composables/use-now'
export { breakpoints, collaborationColors } from '@dou-ui/theme'
export type { Breakpoint } from '@dou-ui/theme'
export { useNamespace, withInstall } from './utils'
export { isComposing } from './utils/keyboard'
export { holdPointer } from './utils/pointer'
export type { PointerHold } from './utils/pointer'
export { CANVAS_MAX_SIDE, canvasMaxArea, fitPixelRatio, svgToPNG } from './utils/png'
export { downloadBlob } from './utils/download'
export type { PNGExportSource, SvgToPNGOptions } from './utils/png'
export type { ForwardedAttributes, Size, Tone, WithAttributes, WithInstall } from './utils'
export type { DataAttributes } from './attributes'
export { DouUI }
export default DouUI
