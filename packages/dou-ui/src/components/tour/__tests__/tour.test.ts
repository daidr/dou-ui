import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouTour } from '../../../index'
import type { TourStep } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

function target(id: string, box = { left: 100, top: 50, width: 80, height: 32 }) {
  const element = document.createElement('button')
  element.id = id
  element.getBoundingClientRect = () => new DOMRect(box.left, box.top, box.width, box.height)
  document.body.append(element)
  return element
}

const steps = (): TourStep[] => [
  { target: '#create', title: '新建项目', description: '从这里新建' },
  { target: () => document.querySelector<HTMLElement>('#members'), title: '邀请成员' },
  { title: '准备就绪', description: '没有目标时显示在屏幕中间' },
]

async function open(props: Record<string, unknown> = {}) {
  target('create')
  target('members', { left: 300, top: 200, width: 120, height: 40 })
  const wrapper = mount(DouTour, { props: { steps: steps(), open: true, ...props } })
  await nextTick()
  await nextTick()
  return wrapper
}

const card = () => document.querySelector<HTMLElement>('.dou-tour__card')!

describe('DouTour', () => {
  it('points at the target with a hole in the mask', async () => {
    await open()
    expect(card().getAttribute('role')).toBe('dialog')
    expect(card().querySelector('.dou-tour__title')!.textContent).toBe('新建项目')
    expect(card().querySelector('.dou-tour__body')!.textContent).toBe('从这里新建')
    expect(card().querySelector('.dou-tour__progress')!.textContent!.trim()).toBe('1 / 3')
    const ring = document.querySelector<HTMLElement>('.dou-tour__ring')!
    // padding 6 around the target
    expect(ring.style.left).toBe('94px')
    expect(ring.style.width).toBe('92px')
    const path = document.querySelector('.dou-tour__mask path')!.getAttribute('d')!
    expect(path).toContain('M0 0H')
    expect(path).toContain('M102 44')
    expect(document.activeElement).toBe(card())
  })

  it('steps forward and back, then finishes', async () => {
    const wrapper = await open()
    const buttons = () => [
      ...card().querySelectorAll<HTMLButtonElement>('.dou-tour__actions button'),
    ]
    expect(buttons().map((b) => b.textContent!.trim())).toEqual(['下一步'])
    buttons()[0]!.click()
    await nextTick()
    expect(wrapper.emitted('update:current')).toEqual([[1]])
    expect(card().querySelector('.dou-tour__title')!.textContent).toBe('邀请成员')
    expect(document.querySelector<HTMLElement>('.dou-tour__ring')!.style.left).toBe('294px')
    expect(buttons().map((b) => b.textContent!.trim())).toEqual(['上一步', '下一步'])

    card().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    // no target: centered, no ring
    expect(document.querySelector('.dou-tour__ring')).toBeNull()
    expect(card().style.top).toBe('50%')
    expect(buttons().at(-1)!.textContent!.trim()).toBe('完成')

    buttons().at(-1)!.click()
    await nextTick()
    expect(wrapper.emitted('finish')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('closes with the close button and Escape', async () => {
    const wrapper = await open()
    card().querySelector<HTMLButtonElement>('.dou-tour__close')!.click()
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])

    const other = await open({ open: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(other.emitted('close')).toHaveLength(1)
  })

  it('closes on the mask only when asked', async () => {
    const wrapper = await open()
    const mask = () => document.querySelector('.dou-tour__mask path')!
    mask().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.setProps({ closeOnMask: true })
    mask().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('leaves out the mask per step and renders slots', async () => {
    target('create')
    mount(DouTour, {
      props: { open: true, steps: [{ target: '#create', mask: false, title: 'a' }] },
      slots: {
        default: ({ current, total }: { current: number; total: number }) =>
          h('em', `${current}/${total}`),
        actions: ({ close }: { close: () => void }) =>
          h('button', { class: 'own', onClick: close }, '知道了'),
      },
    })
    await nextTick()
    expect(document.querySelector('.dou-tour__mask')).toBeNull()
    expect(card().querySelector('em')!.textContent).toBe('0/1')
    expect(card().querySelector('.own')).not.toBeNull()
    expect(card().querySelector('.dou-tour__progress')).toBeNull()
  })
})
