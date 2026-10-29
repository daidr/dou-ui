import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import type { Component } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouDialog, DouDrawer, DouDropdown, DouPopover, DouTooltip } from '../index'

afterEach(() => {
  document.body.innerHTML = ''
})

// Overlays render their panel the first time they open, so the panel has
// to play its enter transition on mount rather than appear at once.
const cases: [string, Component, string, string][] = [
  ['DouTooltip', DouTooltip, '[role="tooltip"]', 'dou-floating'],
  ['DouPopover', DouPopover, '.dou-popover', 'dou-floating'],
  ['DouDropdown', DouDropdown, '.dou-dropdown', 'dou-floating'],
  ['DouDialog', DouDialog, '.dou-dialog', 'dou-dialog'],
  ['DouDrawer', DouDrawer, '.dou-drawer', 'dou-drawer'],
]

describe('first open', () => {
  it.each(cases)('%s plays the enter transition', async (_, component, selector, name) => {
    const wrapper = mount(component, {
      props: { content: '内容', title: '标题' },
      slots: { default: () => h('button', '触发'), content: () => '内容' },
      attachTo: document.body,
      global: { stubs: { transition: false } },
    })
    expect(document.querySelector(selector)).toBeNull()
    await wrapper.setProps({ open: true })
    await nextTick()
    const panel = document.querySelector(selector)
    expect(panel?.closest(`.${name}-enter-active`)).not.toBeNull()
    wrapper.unmount()
  })
})
