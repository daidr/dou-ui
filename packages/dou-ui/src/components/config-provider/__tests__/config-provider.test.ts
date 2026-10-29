import { mount } from '@vue/test-utils'
import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  DouButton,
  DouConfigProvider,
  DouInput,
  DouPopover,
  DouSwitch,
  DouTag,
  DouUI,
  en,
  useGlobalConfig,
  useZIndex,
  zhCN,
} from '../../../index'

describe('DouConfigProvider', () => {
  it('sets the default size of components below it', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { size: 'sm' },
      slots: {
        default: () => [h(DouButton, () => 'a'), h(DouInput), h(DouButton, { size: 'lg' })],
      },
    })
    const [first, last] = wrapper.findAll('.dou-button')
    expect(first!.classes()).toContain('dou-button--sm')
    expect(wrapper.get('.dou-input').classes()).toContain('dou-input--sm')
    // A size set on the component wins.
    expect(last!.classes()).toContain('dou-button--lg')
  })

  it('translates the built-in labels', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { locale: en },
      slots: {
        default: () => [
          h(DouInput, { modelValue: 'x', clearable: true }),
          h(DouTag, { closable: true }, () => 'tag'),
        ],
      },
    })
    expect(wrapper.get('.dou-input__clear').attributes('aria-label')).toBe('Clear')
    expect(wrapper.get('.dou-tag__close').attributes('aria-label')).toBe('Remove')
  })

  it('defaults to Chinese', () => {
    const wrapper = mount(DouInput, { props: { modelValue: 'x', clearable: true } })
    expect(wrapper.get('.dou-input__clear').attributes('aria-label')).toBe(zhCN.input.clear)
  })

  it('inherits what it leaves unset from the provider above', () => {
    let seen: ReturnType<typeof useGlobalConfig> | undefined
    const Probe = defineComponent({
      setup() {
        seen = useGlobalConfig()
        return () => null
      },
    })
    mount(DouConfigProvider, {
      props: { size: 'lg', zIndex: 3000 },
      slots: {
        default: () => h(DouConfigProvider, { locale: en }, () => h(Probe)),
      },
    })
    expect(seen!.value).toEqual({
      size: 'lg',
      locale: en,
      zIndex: 3000,
      defaults: {},
      motion: 'auto',
    })
  })

  it('accepts app-wide defaults through the plugin', () => {
    const app = createApp(() => h(DouButton, () => 'a'))
    app.use(DouUI, { size: 'lg' })
    const root = document.createElement('div')
    app.mount(root)
    expect(root.querySelector('.dou-button')!.classList).toContain('dou-button--lg')
    app.unmount()
  })

  it('stacks z-indexes above the configured base', () => {
    let next: (() => number) | undefined
    const Probe = defineComponent({
      setup() {
        next = useZIndex().next
        return () => null
      },
    })
    mount(DouConfigProvider, { props: { zIndex: 5000 }, slots: { default: () => h(Probe) } })
    const first = next!()
    const second = next!()
    expect(first).toBeGreaterThan(5000)
    expect(second).toBe(first + 1)
  })

  it('fills in component defaults without beating props that were given', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { defaults: { DouButton: { variant: 'outline', tone: 'primary' } } },
      slots: {
        default: () => [h(DouButton, () => 'a'), h(DouButton, { variant: 'ghost' }, () => 'b')],
      },
    })
    const [first, second] = wrapper.findAll('.dou-button')
    expect(first!.classes()).toEqual(
      expect.arrayContaining(['dou-button--outline', 'dou-button--primary']),
    )
    expect(second!.classes()).toContain('dou-button--ghost')
    expect(second!.classes()).toContain('dou-button--primary')
  })

  it('merges component defaults of nested providers', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { defaults: { DouButton: { variant: 'outline' } } },
      slots: {
        default: () =>
          h(DouConfigProvider, { defaults: { DouButton: { tone: 'danger' } } }, () =>
            h(DouButton, () => 'a'),
          ),
      },
    })
    expect(wrapper.get('.dou-button').classes()).toEqual(
      expect.arrayContaining(['dou-button--outline', 'dou-button--danger']),
    )
  })

  it('keeps boolean props false when nothing is configured', () => {
    const wrapper = mount(DouSwitch)
    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('false')
    expect(wrapper.classes()).not.toContain('is-disabled')
  })

  it('renders floating layers into the configured container', async () => {
    const host = document.createElement('div')
    host.id = 'overlay-host'
    document.body.append(host)
    mount(DouConfigProvider, {
      props: { teleport: '#overlay-host' },
      slots: {
        default: () =>
          h(DouPopover, { open: true }, { default: () => h('button', 'a'), content: () => 'hi' }),
      },
      attachTo: document.body,
    })
    await new Promise((resolve) => setTimeout(resolve))
    expect(host.querySelector('.dou-popover')).not.toBeNull()
    host.remove()
  })
})
