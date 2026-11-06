import type { InjectionKey } from 'vue'

/** The least room a splitter needs, in px, for its own px limits and those of splitters inside it. */
export interface SplitterMinSize {
  width: number
  height: number
}

/** How a splitter tells the one around it what it needs, so px limits hold however deep it sits. */
export interface SplitterContext {
  register: (el: HTMLElement, need: () => SplitterMinSize) => () => void
}

export const splitterContextKey: InjectionKey<SplitterContext> = Symbol('DouSplitter')
