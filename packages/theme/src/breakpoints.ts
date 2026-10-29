/**
 * The viewport widths, in px, where layouts change. Each applies from its
 * width up (mobile first); below `sm` is the base. Media queries cannot
 * read custom properties, so these are plain numbers: use them in script,
 * or copy them into `@media (min-width: …)` rules.
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

export type Breakpoint = keyof typeof breakpoints
