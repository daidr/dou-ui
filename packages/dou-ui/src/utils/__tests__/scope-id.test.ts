import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import {
  Comment,
  Fragment,
  createSSRApp,
  createVNode,
  defineComponent,
  h,
  nextTick,
  ref,
  renderSlot,
} from 'vue'
import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { DouAutocomplete } from '../../components/autocomplete'
import { DouCascader } from '../../components/cascader'
import { DouColorModeSelect } from '../../components/color-mode'
import { DouColorPicker } from '../../components/color-picker'
import { DouCommandDialog } from '../../components/command'
import { DouContextMenu } from '../../components/context-menu'
import { DouCopyButton } from '../../components/copy-button'
import { DouDatePicker } from '../../components/date-picker'
import { DouDialog } from '../../components/dialog'
import { DouDrawer } from '../../components/drawer'
import {
  DouDropdown,
  DouDropdownGroup,
  DouDropdownItem,
  DouDropdownRadioGroup,
  DouDropdownSub,
} from '../../components/dropdown'
import { DouEllipsis } from '../../components/ellipsis'
import { DouImage, DouImagePreview } from '../../components/image'
import { DouInput } from '../../components/input'
import { DouInputDate } from '../../components/input-date'
import { DouInputTime } from '../../components/input-time'
import { DouLoading } from '../../components/loading'
import { DouMenubar, DouMenubarMenu } from '../../components/menubar'
import { DouNodeGraph } from '../../components/node-graph'
import { DouPopconfirm } from '../../components/popconfirm'
import { DouPopover } from '../../components/popover'
import { DouSelect } from '../../components/select'
import { DouTimePicker } from '../../components/time-picker'
import { DouToastViewport, toast } from '../../components/toast'
import { DouTooltip } from '../../components/tooltip'
import { DouTour } from '../../components/tour'
import { DouTreeSelect } from '../../components/tree-select'

const PARENT_SCOPE = 'data-v-parent01'
const WRAPPER_SCOPE = 'data-v-wrap0002'
const SLOT_HOST_SCOPE = 'data-v-host0003'
const SLOT_HOST_SLOTTED = `${SLOT_HOST_SCOPE}-s`

function mountScoped(
  renderContent: () => ReturnType<typeof h>,
  scopeId = PARENT_SCOPE,
  attachToBody = false,
) {
  const Parent = defineComponent({
    name: 'ScopedParent',
    __scopeId: scopeId,
    render() {
      return h('section', { class: 'scope-host' }, [renderContent()])
    },
  })
  return mount(Parent, attachToBody ? { attachTo: document.body } : undefined)
}

function createSlottedHost() {
  return defineComponent({
    name: 'SlottedHost',
    __scopeId: SLOT_HOST_SCOPE,
    render() {
      // Mirrors what `@vue/compiler-sfc` emits for `<slot />` inside a scoped SFC:
      // `renderSlot($slots, 'default', {}, undefined, false)` attaches `data-v-xxx-s`
      // as `slotScopeIds` on the slot Fragment when `noSlotted` is false.
      return h('div', { class: 'slot-host' }, [renderSlot(this.$slots, 'default')])
    },
  })
}

afterEach(() => {
  toast.closeAll()
  document.body.innerHTML = ''
})

describe('scoped class attribute propagation', () => {
  describe('floating form controls forward parent scopeId to their trigger element', () => {
    const cases: Array<{
      name: string
      selector: string
      render: () => ReturnType<typeof h>
    }> = [
      {
        name: 'DouInput (baseline)',
        selector: '.dou-input',
        render: () => h(DouInput, { class: 'probe-cls' }),
      },
      {
        name: 'DouAutocomplete (single-line)',
        selector: '.dou-autocomplete',
        render: () => h(DouAutocomplete, { class: 'probe-cls', options: ['alpha', 'beta'] }),
      },
      {
        name: 'DouAutocomplete (multiline)',
        selector: '.dou-autocomplete.is-multiline',
        render: () =>
          h(DouAutocomplete, { class: 'probe-cls', multiline: true, options: ['alpha', 'beta'] }),
      },
      {
        name: 'DouSelect',
        selector: '.dou-select',
        render: () => h(DouSelect, { class: 'probe-cls', options: [{ value: 'a', label: 'A' }] }),
      },
      {
        name: 'DouSelect (filterable)',
        selector: '.dou-select',
        render: () =>
          h(DouSelect, {
            class: 'probe-cls',
            filterable: true,
            options: [{ value: 'a', label: 'A' }],
          }),
      },
      {
        name: 'DouCascader',
        selector: '.dou-cascader',
        render: () => h(DouCascader, { class: 'probe-cls', options: [{ value: 'a', label: 'A' }] }),
      },
      {
        name: 'DouColorPicker',
        selector: '.dou-color-picker',
        render: () => h(DouColorPicker, { class: 'probe-cls' }),
      },
      {
        name: 'DouDatePicker',
        selector: '.dou-date-picker',
        render: () => h(DouDatePicker, { class: 'probe-cls' }),
      },
      {
        name: 'DouTimePicker',
        selector: '.dou-time-picker',
        render: () => h(DouTimePicker, { class: 'probe-cls' }),
      },
      {
        name: 'DouTreeSelect',
        selector: '.dou-tree-select',
        render: () => h(DouTreeSelect, { class: 'probe-cls', data: [{ key: 'a', label: 'A' }] }),
      },
      {
        name: 'DouInputDate',
        selector: '.dou-input-date',
        render: () => h(DouInputDate, { class: 'probe-cls' }),
      },
      {
        name: 'DouInputTime',
        selector: '.dou-input-date.is-time',
        render: () => h(DouInputTime, { class: 'probe-cls' }),
      },
      {
        name: 'DouColorModeSelect',
        selector: '.dou-color-mode-select',
        render: () => h(DouColorModeSelect, { class: 'probe-cls' }),
      },
    ]

    it.each(cases)('$name', ({ selector, render }) => {
      const wrapper = mountScoped(render)
      const trigger = wrapper.find(selector)
      expect(trigger.exists()).toBe(true)
      expect(trigger.classes()).toContain('probe-cls')
      expect(trigger.attributes(PARENT_SCOPE)).toBe('')
      wrapper.unmount()
    })

    it('keeps DouAutocomplete scopeId on the root wrapper without leaking to inner input/textarea, even across multiline toggles', async () => {
      const multiline = ref(false)
      const Parent = defineComponent({
        __scopeId: PARENT_SCOPE,
        setup() {
          return () =>
            h('section', [
              h(DouAutocomplete, {
                class: 'probe-cls',
                multiline: multiline.value,
                options: ['alpha'],
              }),
            ])
        },
      })
      const wrapper = mount(Parent)
      expect(wrapper.find('.dou-input').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('input').attributes(PARENT_SCOPE)).toBeUndefined()

      multiline.value = true
      await nextTick()
      expect(wrapper.find('.dou-textarea').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.dou-textarea').classes()).toContain('probe-cls')
      expect(wrapper.find('textarea').attributes(PARENT_SCOPE)).toBeUndefined()

      multiline.value = false
      await nextTick()
      expect(wrapper.find('.dou-input').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('input').attributes(PARENT_SCOPE)).toBeUndefined()
      wrapper.unmount()
    })
  })

  describe('overlay, teleported, and multi-root components', () => {
    it('applies parent scopeId to DouTooltip panel while leaving trigger untouched', async () => {
      const wrapper = mountScoped(
        () =>
          h(
            DouTooltip,
            { class: 'probe-tip', content: 'Hint', open: true, teleport: false },
            { default: () => h('button', { class: 'probe-trigger' }, 'Hover') },
          ),
        PARENT_SCOPE,
      )
      await nextTick()
      const panel = wrapper.find('.dou-tooltip')
      expect(panel.classes()).toContain('probe-tip')
      expect(panel.attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.probe-trigger').attributes(PARENT_SCOPE)).toBe('')
      wrapper.unmount()
    })

    it('does not leak a scoped wrapper around DouTooltip onto parent slot trigger content', async () => {
      const ScopedTooltipWrapper = defineComponent({
        __scopeId: WRAPPER_SCOPE,
        render() {
          return h(
            DouTooltip,
            { class: 'wrapper-tip', content: 'Info', open: true, teleport: false },
            { default: () => this.$slots.default?.() },
          )
        },
      })
      const wrapper = mountScoped(
        () =>
          h(ScopedTooltipWrapper, null, {
            default: () => h('button', { class: 'caller-btn' }, 'Trigger'),
          }),
        PARENT_SCOPE,
      )
      await nextTick()
      const btn = wrapper.find('.caller-btn')
      expect(btn.attributes(PARENT_SCOPE)).toBe('')
      expect(btn.attributes(WRAPPER_SCOPE)).toBeUndefined()
      const panel = wrapper.find('.dou-tooltip')
      expect(panel.attributes(WRAPPER_SCOPE)).toBe('')
      expect(panel.attributes(PARENT_SCOPE)).toBe('')
      wrapper.unmount()
    })

    it('applies parent scopeId to DouPopover and DouPopconfirm panels', async () => {
      const pop = mountScoped(
        () =>
          h(
            DouPopover,
            { class: 'probe-pop', open: true, teleport: false, content: 'Body' },
            { default: () => h('button', 'Open') },
          ),
        PARENT_SCOPE,
      )
      await nextTick()
      expect(pop.find('.dou-popover').classes()).toContain('probe-pop')
      expect(pop.find('.dou-popover').attributes(PARENT_SCOPE)).toBe('')
      pop.unmount()

      const confirm = mountScoped(
        () =>
          h(
            DouPopconfirm,
            { class: 'probe-confirm', open: true, teleport: false, title: 'Confirm?' },
            { default: () => h('button', 'Delete') },
          ),
        PARENT_SCOPE,
      )
      await nextTick()
      expect(confirm.find('.dou-popconfirm').classes()).toContain('probe-confirm')
      expect(confirm.find('.dou-popconfirm').attributes(PARENT_SCOPE)).toBe('')
      confirm.unmount()
    })

    it('applies parent scopeId to DouDropdown panel, items, groups, radio groups, and submenus', async () => {
      const wrapper = mountScoped(
        () =>
          h(
            DouDropdown,
            { class: 'probe-menu', open: true, teleport: false },
            {
              default: () => h('button', 'Menu'),
              menu: () => [
                h(
                  DouDropdownGroup,
                  { class: 'probe-group', label: 'Group', divided: true },
                  {
                    default: () => [
                      h(
                        DouDropdownItem,
                        { class: 'probe-item', value: 'a', divided: true },
                        () => 'A',
                      ),
                    ],
                  },
                ),
                h(
                  DouDropdownRadioGroup,
                  { class: 'probe-radio-group', label: 'Radio' },
                  {
                    default: () => [h(DouDropdownItem, { value: 'b' }, () => 'B')],
                  },
                ),
                h(
                  DouDropdownSub,
                  { class: 'probe-sub', title: 'More', divided: true },
                  { default: () => [h(DouDropdownItem, { value: 'c' }, () => 'C')] },
                ),
              ],
            },
          ),
        PARENT_SCOPE,
      )
      await nextTick()
      expect(wrapper.find('.dou-dropdown').classes()).toContain('probe-menu')
      expect(wrapper.find('.dou-dropdown').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.probe-group').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.probe-item').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.probe-radio-group').attributes(PARENT_SCOPE)).toBe('')
      const subTrigger = wrapper.find('.probe-sub')
      expect(subTrigger.attributes(PARENT_SCOPE)).toBe('')
      await subTrigger.trigger('click')
      await nextTick()
      const subPanel = document.body.querySelector('.dou-dropdown--sub')
      expect(subPanel).not.toBeNull()
      expect(subPanel!.classList.contains('probe-menu')).toBe(true)
      expect(subPanel!.hasAttribute(PARENT_SCOPE)).toBe(true)
      wrapper.unmount()
    })

    it('applies parent scopeId to DouContextMenu panel', async () => {
      const wrapper = mountScoped(
        () =>
          h(
            DouContextMenu as Component,
            { class: 'probe-ctx', teleport: false, items: [{ value: 'x', label: 'Copy' }] },
            { default: () => h('div', { class: 'ctx-area' }, 'Right click') },
          ),
        PARENT_SCOPE,
      )
      await wrapper.find('.ctx-area').trigger('contextmenu', { clientX: 10, clientY: 10 })
      await nextTick()
      const menu = wrapper.find('.dou-context-menu')
      expect(menu.classes()).toContain('probe-ctx')
      expect(menu.attributes(PARENT_SCOPE)).toBe('')
      wrapper.unmount()
    })

    it('applies parent scopeId to DouDialog, DouCommandDialog, and DouDrawer panels', async () => {
      const dlg = mountScoped(
        () => h(DouDialog, { class: 'probe-dialog', open: true, teleport: false, title: 'Hi' }),
        PARENT_SCOPE,
      )
      await nextTick()
      expect(dlg.find('.dou-dialog__panel').classes()).toContain('probe-dialog')
      expect(dlg.find('.dou-dialog__panel').attributes(PARENT_SCOPE)).toBe('')
      dlg.unmount()

      const cmd = mountScoped(
        () =>
          h(DouCommandDialog, {
            class: 'probe-cmd',
            open: true,
            items: [{ value: 'a', label: 'A' }],
          }),
        PARENT_SCOPE,
        true,
      )
      await nextTick()
      const cmdPanel = document.body.querySelector('.dou-command-dialog')
      expect(cmdPanel).not.toBeNull()
      expect(cmdPanel!.classList.contains('probe-cmd')).toBe(true)
      expect(cmdPanel!.hasAttribute(PARENT_SCOPE)).toBe(true)
      cmd.unmount()

      const drawer = mountScoped(
        () => h(DouDrawer, { class: 'probe-drawer', open: true, teleport: false, title: 'Drawer' }),
        PARENT_SCOPE,
      )
      await nextTick()
      expect(drawer.find('.dou-drawer__panel').classes()).toContain('probe-drawer')
      expect(drawer.find('.dou-drawer__panel').attributes(PARENT_SCOPE)).toBe('')
      drawer.unmount()
    })

    it('applies parent scopeId to DouImage, DouImagePreview, DouLoading, DouTour, and DouToastViewport', async () => {
      const img = mountScoped(
        () => h(DouImage, { class: 'probe-img', src: 'https://example.com/a.png', preview: true }),
        PARENT_SCOPE,
        true,
      )
      expect(img.find('.dou-image').classes()).toContain('probe-img')
      expect(img.find('.dou-image').attributes(PARENT_SCOPE)).toBe('')
      // Opening DouImage's internal preview should not leak DouImage's parent scope onto the preview dialog.
      await img.find('img').trigger('load')
      await img.find('.dou-image').trigger('click')
      await nextTick()
      const internalPreview = document.body.querySelector('.dou-image-preview')
      expect(internalPreview).not.toBeNull()
      expect(internalPreview!.hasAttribute(PARENT_SCOPE)).toBe(false)
      img.unmount()

      const preview = mountScoped(
        () =>
          h(DouImagePreview, {
            class: 'probe-preview',
            open: true,
            teleport: false,
            images: ['https://example.com/a.png'],
          }),
        PARENT_SCOPE,
      )
      await nextTick()
      expect(preview.find('.dou-image-preview').classes()).toContain('probe-preview')
      expect(preview.find('.dou-image-preview').attributes(PARENT_SCOPE)).toBe('')
      preview.unmount()

      const loading = mountScoped(
        () =>
          h(
            DouLoading,
            { class: 'probe-loading', loading: true },
            { default: () => h('p', 'Content') },
          ),
        PARENT_SCOPE,
      )
      expect(loading.find('.dou-loading').classes()).toContain('probe-loading')
      expect(loading.find('.dou-loading').attributes(PARENT_SCOPE)).toBe('')
      loading.unmount()

      const tour = mountScoped(
        () =>
          h(DouTour, {
            class: 'probe-tour',
            open: true,
            teleport: false,
            steps: [{ title: 'Step 1', description: 'Desc' }],
          }),
        PARENT_SCOPE,
      )
      await nextTick()
      expect(tour.find('.dou-tour__card').classes()).toContain('probe-tour')
      expect(tour.find('.dou-tour__card').attributes(PARENT_SCOPE)).toBe('')
      tour.unmount()

      const viewport = mountScoped(
        () => h(DouToastViewport, { class: 'probe-toast' }),
        PARENT_SCOPE,
        true,
      )
      toast('Saved')
      await nextTick()
      const region = document.body.querySelector('.dou-toast')
      expect(region).not.toBeNull()
      expect(region!.classList.contains('probe-toast')).toBe(true)
      expect(region!.hasAttribute(PARENT_SCOPE)).toBe(true)
      viewport.unmount()
    })
  })

  describe('claimed-scope wrappers keep parent scopeId on their visible trigger and away from internal overlays', () => {
    it('DouCopyButton', async () => {
      const wrapper = mountScoped(
        () => h(DouCopyButton, { class: 'probe-copy', text: 'hello' }),
        PARENT_SCOPE,
        true,
      )
      const btn = wrapper.find('.dou-copy-button')
      expect(btn.classes()).toContain('probe-copy')
      expect(btn.attributes(PARENT_SCOPE)).toBe('')
      await btn.trigger('focusin')
      await nextTick()
      const tip = document.body.querySelector('.dou-tooltip')
      expect(tip).not.toBeNull()
      expect(tip!.hasAttribute(PARENT_SCOPE)).toBe(false)
      wrapper.unmount()
    })

    it('DouEllipsis (with and without tooltip)', () => {
      const plain = mountScoped(
        () => h(DouEllipsis, { class: 'probe-ellipsis' }, () => 'Long text'),
        PARENT_SCOPE,
      )
      expect(plain.find('.dou-ellipsis').classes()).toContain('probe-ellipsis')
      expect(plain.find('.dou-ellipsis').attributes(PARENT_SCOPE)).toBe('')
      plain.unmount()

      const withTip = mountScoped(
        () => h(DouEllipsis, { class: 'probe-ellipsis', tooltip: true }, () => 'Long text'),
        PARENT_SCOPE,
      )
      expect(withTip.find('.dou-ellipsis').classes()).toContain('probe-ellipsis')
      expect(withTip.find('.dou-ellipsis').attributes(PARENT_SCOPE)).toBe('')
      withTip.unmount()
    })

    it('DouMenubarMenu', async () => {
      const wrapper = mountScoped(
        () =>
          h(DouMenubar, null, {
            default: () => [
              h(
                DouMenubarMenu,
                { class: 'probe-menu-btn', label: 'File' },
                { default: () => [h(DouDropdownItem, { value: 'new' }, () => 'New')] },
              ),
            ],
          }),
        PARENT_SCOPE,
        true,
      )
      const btn = wrapper.find('.dou-menubar__trigger')
      expect(btn.classes()).toContain('probe-menu-btn')
      expect(btn.attributes(PARENT_SCOPE)).toBe('')
      await btn.trigger('click')
      await nextTick()
      const panel = document.body.querySelector('.dou-dropdown')
      expect(panel).not.toBeNull()
      expect(panel!.hasAttribute(PARENT_SCOPE)).toBe(false)
      wrapper.unmount()
    })

    it('does not leak parent scopeId onto internal DouNodeGraph nodes via OnlyChild', () => {
      const wrapper = mountScoped(
        () =>
          h(DouNodeGraph, {
            class: 'probe-graph',
            nodes: [{ id: 'a', label: 'Start' }],
            edges: [],
          }),
        PARENT_SCOPE,
      )
      expect(wrapper.find('.dou-node-graph').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.dou-node-graph__node').attributes(PARENT_SCOPE)).toBeUndefined()
      wrapper.unmount()
    })
  })

  describe('slotScopeIds (:slotted) and multi-level single-root wrapper chains', () => {
    it('forwards both parent scopeId and host slotScopeIds to DouAutocomplete, DouSelect, and DouDialog', async () => {
      const SlottedHost = createSlottedHost()
      const Parent = defineComponent({
        __scopeId: PARENT_SCOPE,
        render() {
          return h(SlottedHost, null, {
            default: () => [
              h(DouAutocomplete, { class: 'slot-ac', options: ['a'] }),
              h(DouSelect, { class: 'slot-sel', options: [{ value: 'a', label: 'A' }] }),
              h(DouDialog, { class: 'slot-dlg', open: true, teleport: false, title: 'T' }),
              h(DouCopyButton, { class: 'slot-copy', text: 'x' }),
            ],
          })
        },
      })
      const wrapper = mount(Parent)
      await nextTick()

      for (const selector of ['.slot-ac', '.slot-sel', '.slot-dlg', '.slot-copy']) {
        const el = wrapper.find(selector)
        expect(el.exists()).toBe(true)
        expect(el.attributes(PARENT_SCOPE)).toBe('')
        expect(el.attributes(SLOT_HOST_SLOTTED)).toBe('')
      }
      expect(wrapper.find('.slot-ac input').attributes(PARENT_SCOPE)).toBeUndefined()
      expect(wrapper.find('.slot-ac input').attributes(SLOT_HOST_SLOTTED)).toBeUndefined()
      wrapper.unmount()
    })

    it('preserves every scopeId through user-defined single-root wrappers (inheritAttrs true and false)', async () => {
      const InheritSelect = defineComponent({
        __scopeId: WRAPPER_SCOPE,
        render() {
          return h(DouSelect, { class: 'inner-cls', options: [{ value: 'a', label: 'A' }] })
        },
      })
      const ManualAutocomplete = defineComponent({
        inheritAttrs: false,
        __scopeId: WRAPPER_SCOPE,
        render() {
          return h(DouAutocomplete, {
            ...this.$attrs,
            class: ['inner-cls', this.$attrs.class],
            options: ['a'],
          })
        },
      })
      const ManualPopover = defineComponent({
        inheritAttrs: false,
        __scopeId: WRAPPER_SCOPE,
        render() {
          return h(
            DouPopover,
            { ...this.$attrs, open: true, teleport: false, content: 'Hi' },
            { default: () => h('button', 'Open') },
          )
        },
      })

      const wrapper = mountScoped(
        () =>
          h('div', [
            h(InheritSelect, { class: 'outer-sel' }),
            h(ManualAutocomplete, { class: 'outer-ac' }),
            h(ManualPopover, { class: 'outer-pop' }),
          ]),
        PARENT_SCOPE,
      )
      await nextTick()

      for (const selector of ['.outer-sel', '.outer-ac', '.outer-pop']) {
        const el = wrapper.find(selector)
        expect(el.exists()).toBe(true)
        expect(el.attributes(PARENT_SCOPE)).toBe('')
        expect(el.attributes(WRAPPER_SCOPE)).toBe('')
      }
      wrapper.unmount()
    })

    it('keeps scopeId when a form control or DouPopconfirm sits inside DouTooltip as its trigger', async () => {
      const wrapper = mountScoped(
        () =>
          h('div', [
            h(
              DouTooltip,
              { class: 'outer-tip', content: 'Choose one', open: true, teleport: false },
              {
                default: () =>
                  h(DouSelect, { class: 'inner-sel', options: [{ value: 'a', label: 'A' }] }),
              },
            ),
            h(
              DouTooltip,
              { class: 'outer-tip-2', content: 'Danger', open: true, teleport: false },
              {
                default: () =>
                  h(
                    DouPopconfirm,
                    { class: 'inner-confirm', title: 'Sure?', open: true, teleport: false },
                    { default: () => h('button', { class: 'inner-btn' }, 'Delete') },
                  ),
              },
            ),
          ]),
        PARENT_SCOPE,
      )
      await nextTick()
      expect(wrapper.find('.inner-sel').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.outer-tip').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.inner-btn').attributes(PARENT_SCOPE)).toBe('')
      expect(wrapper.find('.inner-confirm').attributes(PARENT_SCOPE)).toBe('')
      wrapper.unmount()
    })

    it('walks through DEV_ROOT_FRAGMENT wrappers (single-root template with root comments) and keeps focus/popup working', async () => {
      const DEV_ROOT_FRAGMENT = 1 << 11
      const CommentedWrapper = defineComponent({
        __scopeId: WRAPPER_SCOPE,
        render() {
          return createVNode(
            Fragment,
            null,
            [
              createVNode(Comment, null, 'leading comment'),
              h(DouSelect, {
                class: 'commented-sel',
                teleport: false,
                options: [{ value: 'a', label: 'Alpha' }],
              }),
            ],
            DEV_ROOT_FRAGMENT,
          )
        },
      })
      const SlottedHost = createSlottedHost()
      const Parent = defineComponent({
        __scopeId: PARENT_SCOPE,
        render() {
          return h(SlottedHost, null, {
            default: () => [h(CommentedWrapper, { class: 'outer-cls' })],
          })
        },
      })
      const wrapper = mount(Parent, { attachTo: document.body })
      const field = wrapper.find('.commented-sel')
      expect(field.exists()).toBe(true)
      expect(field.attributes(PARENT_SCOPE)).toBe('')
      expect(field.attributes(WRAPPER_SCOPE)).toBe('')
      expect(field.attributes(SLOT_HOST_SLOTTED)).toBe('')

      await field.trigger('mousedown')
      await nextTick()
      expect(wrapper.find('.dou-select__menu').isVisible()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('SSR rendering', () => {
    it('renders parent scopeId and slotScopeId on floating form controls and wrappers without leaking to inner input', async () => {
      const SlottedHost = createSlottedHost()
      const WrappedSelect = defineComponent({
        __scopeId: WRAPPER_SCOPE,
        render() {
          return h(DouSelect, { class: 'ssr-wrapped-sel', options: [{ value: 'a', label: 'A' }] })
        },
      })
      const Parent = defineComponent({
        __scopeId: PARENT_SCOPE,
        render() {
          return h('main', [
            h(DouAutocomplete, { class: 'ssr-ac', options: ['a'] }),
            h(DouSelect, { class: 'ssr-sel', options: [{ value: 'a', label: 'A' }] }),
            h(DouInputDate, { class: 'ssr-date' }),
            h(DouCopyButton, { class: 'ssr-copy', text: 'x' }),
            h(WrappedSelect, { class: 'ssr-outer' }),
            h(SlottedHost, null, {
              default: () => [
                h(DouAutocomplete, { class: 'ssr-slot-ac', options: ['a'] }),
                h(DouSelect, { class: 'ssr-slot-sel', options: [{ value: 'a', label: 'A' }] }),
              ],
            }),
          ])
        },
      })

      const html = await renderToString(createSSRApp(Parent))
      const doc = new DOMParser().parseFromString(html, 'text/html')

      const ac = doc.querySelector('.ssr-ac')!
      expect(ac).not.toBeNull()
      expect(ac.hasAttribute(PARENT_SCOPE)).toBe(true)
      expect(ac.querySelector('input')!.hasAttribute(PARENT_SCOPE)).toBe(false)

      for (const selector of ['.ssr-sel', '.ssr-date', '.ssr-copy']) {
        const el = doc.querySelector(selector)!
        expect(el).not.toBeNull()
        expect(el.hasAttribute(PARENT_SCOPE)).toBe(true)
      }

      const wrapped = doc.querySelector('.ssr-wrapped-sel')!
      expect(wrapped).not.toBeNull()
      expect(wrapped.hasAttribute(PARENT_SCOPE)).toBe(true)
      expect(wrapped.hasAttribute(WRAPPER_SCOPE)).toBe(true)

      const slotAc = doc.querySelector('.ssr-slot-ac')!
      expect(slotAc.hasAttribute(PARENT_SCOPE)).toBe(true)
      expect(slotAc.hasAttribute(SLOT_HOST_SLOTTED)).toBe(true)
      expect(slotAc.querySelector('input')!.hasAttribute(PARENT_SCOPE)).toBe(false)

      const slotSel = doc.querySelector('.ssr-slot-sel')!
      expect(slotSel.hasAttribute(PARENT_SCOPE)).toBe(true)
      expect(slotSel.hasAttribute(SLOT_HOST_SLOTTED)).toBe(true)
    })
  })
})
