import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { getTabbable, useFocusTrap } from '../use-focus-trap'

const Trapped = defineComponent({
  props: { active: Boolean },
  setup(props) {
    const container = ref<HTMLElement | null>(null)
    useFocusTrap(container, { active: () => props.active })
    return () =>
      h('div', { ref: container, tabindex: -1 }, [
        h('button', { id: 'first' }, 'first'),
        h('button', { disabled: true }, 'disabled'),
        h('a', { href: '#', id: 'last' }, 'last'),
      ])
  },
})

describe('useFocusTrap', () => {
  it('finds tabbable elements in order', () => {
    const wrapper = mount(Trapped, { attachTo: document.body })
    expect(getTabbable(wrapper.element as HTMLElement).map((el) => el.id)).toEqual([
      'first',
      'last',
    ])
    wrapper.unmount()
  })

  it('moves focus in, wraps Tab and hands focus back', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()

    const wrapper = mount(Trapped, { attachTo: document.body })
    await wrapper.setProps({ active: true })
    await nextTick()
    expect(document.activeElement?.id).toBe('first')

    document.getElementById('last')!.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.activeElement!.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('first')

    const back = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    document.activeElement!.dispatchEvent(back)
    expect(document.activeElement?.id).toBe('last')

    // Focus wandering outside is pulled back in.
    outside.focus()
    expect(document.activeElement?.id).toBe('first')

    await wrapper.setProps({ active: false })
    expect(document.activeElement).toBe(outside)
    wrapper.unmount()
    outside.remove()
  })
})
