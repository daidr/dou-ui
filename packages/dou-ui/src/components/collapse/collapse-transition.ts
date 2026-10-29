import { Transition, defineComponent, h } from 'vue'

const reset = (el: Element) => {
  const style = (el as HTMLElement).style
  style.height = ''
  style.overflow = ''
}

/**
 * Animate an element's height between zero and its natural size. Used by
 * every disclosure (collapse items, menu submenus) so they move alike, and
 * exported as `DouCollapseTransition` for content of your own.
 */
export const CollapseTransition = defineComponent({
  name: 'DouCollapseTransition',
  setup:
    (_, { slots }) =>
    () =>
      h(
        Transition,
        {
          name: 'dou-collapse',
          onBeforeEnter(el) {
            const style = (el as HTMLElement).style
            style.height = '0'
            style.overflow = 'hidden'
          },
          onEnter(el) {
            ;(el as HTMLElement).style.height = `${el.scrollHeight}px`
          },
          onAfterEnter: reset,
          onEnterCancelled: reset,
          onBeforeLeave(el) {
            const style = (el as HTMLElement).style
            style.height = `${el.scrollHeight}px`
            style.overflow = 'hidden'
          },
          onLeave(el) {
            // read layout so the browser starts from the measured height
            void (el as HTMLElement).offsetHeight
            ;(el as HTMLElement).style.height = '0'
          },
          onAfterLeave: reset,
          onLeaveCancelled: reset,
        },
        slots,
      ),
})
