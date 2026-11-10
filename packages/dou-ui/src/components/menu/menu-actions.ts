import { defineComponent, h, inject, nextTick, onBeforeUpdate, onUpdated, shallowRef } from 'vue'
import type { PropType, VNode } from 'vue'
import { useResizeObserver } from '../../composables/use-element-size'
import { useNamespace } from '../../utils/namespace'
import { rendersSomething } from '../../utils/slot'
import { menuKey } from './menu'
import type { MenuItemOption } from './menu'

export default defineComponent({
  name: 'DouMenuActions',
  props: {
    item: { type: Object as PropType<MenuItemOption>, required: true },
    selected: { type: Boolean, default: false },
  },
  setup(props) {
    const ns = useNamespace('menu')
    const menu = inject(menuKey)!

    const el = shallowRef<HTMLElement | null>(null)
    const setEl = (value: unknown) => (el.value = value instanceof HTMLElement ? value : null)

    // The item keeps clear of the actions laid over its end: it takes their
    // width as end padding (see menu.css).
    useResizeObserver(el, ([entry]) => {
      const li = el.value?.parentElement
      if (li && entry)
        li.style.setProperty('--dou-menu-actions-width', `${entry.contentRect.width}px`)
    })

    // A button that goes away once pressed ("done") would leave the focus on
    // the page: hand it back to the item of the same row.
    let row: HTMLElement | null = null
    onBeforeUpdate(() => {
      row = el.value?.contains(document.activeElement) ? el.value.parentElement : null
    })
    onUpdated(() => {
      const li = row
      row = null
      if (!li) return
      void nextTick(() => {
        if (li.contains(document.activeElement)) return
        li.querySelector<HTMLElement>(':scope > .dou-menu__item')?.focus()
      })
    })

    // The slot is called once a render; nothing is drawn for an item it leaves
    // alone. Beside the item, never in it: a button may not hold another one.
    return () => {
      const nodes = menu.actionsSlot()?.({ item: props.item, selected: props.selected }) as
        VNode[] | undefined
      return rendersSomething(nodes)
        ? h('span', { ref: setEl, class: ns.e('actions') }, nodes)
        : null
    }
  },
})
