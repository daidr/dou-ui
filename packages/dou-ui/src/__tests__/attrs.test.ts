import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import type { Component } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import * as Dou from '../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const probe = { class: 'x-probe', style: 'margin-top: 7px', 'data-probe': '' }

// props a component needs to render its outermost element
const required: Record<string, Record<string, unknown>> = {
  DouSelect: { options: [{ value: 1, label: 'a' }], modelValue: null },
  DouTabPanel: { name: 'a', label: 'A' },
  DouTree: { data: [] },
  DouVirtualList: { items: [], itemSize: 20 },
  DouTable: { data: [], columns: [] },
  DouDescriptionsItem: { label: 'x' },
  DouPagination: { total: 100 },
  DouBreadcrumb: { items: [{ label: 'a' }] },
  DouCommand: { items: [] },
  DouCommandDialog: { open: true, items: [] },
  DouSegmentedControl: { options: ['a'] },
  DouDialog: { open: true },
  DouDrawer: { open: true },
  DouTooltip: { open: true, content: 'c' },
  DouPopover: { open: true },
  DouDropdown: { open: true },
}

// floating components put attrs on the panel, not on the trigger
const floating = new Set(['DouTooltip', 'DouPopover', 'DouDropdown'])
// form controls keep class / style on the frame and the rest on the native control
const fields: Record<string, string> = {
  DouCheckbox: 'input',
  DouRadio: 'input',
  DouSwitch: 'button',
  DouInput: 'input',
  DouInputNumber: 'input',
  DouTextarea: 'textarea',
}
// render no element of their own
const renderless = new Set(['DouConfigProvider', 'DouToastViewport'])

const components = Object.entries(Dou).filter(
  ([name, value]) =>
    /^Dou[A-Z]/.test(name) &&
    typeof value === 'object' &&
    value !== null &&
    ('setup' in value || 'render' in value || '__name' in value) &&
    !renderless.has(name),
) as [string, Component][]

describe('attribute passthrough', () => {
  it.each(components)('%s puts class, style and attributes on one element', async (name, comp) => {
    mount(comp, {
      props: required[name] ?? {},
      attrs: probe,
      slots: floating.has(name)
        ? { default: () => h('button', 'trigger'), content: () => 'content' }
        : { default: () => 'x' },
      attachTo: document.body,
    })
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const styled = document.querySelector<HTMLElement>('.x-probe')
    expect(styled, 'class').not.toBeNull()
    expect(styled!.style.marginTop).toBe('7px')

    // the element that takes the remaining attributes: the native control
    // inside form controls, the same element everywhere else
    const tagged = document.querySelector('[data-probe]')
    const expected = fields[name] ? styled!.querySelector(fields[name]) : styled
    expect(tagged).toBe(expected)
    // floating components never dress the trigger
    expect(floating.has(name) && !!styled!.closest('button')).toBe(false)
  })
})
