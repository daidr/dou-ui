import { createApp, defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouUI, dialog, en, useDialog } from '../../../index'
import type { DialogApi } from '../../../index'

afterEach(() => {
  dialog.closeAll()
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

const settle = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}
// A closed box stays in the page until its leave transition ends, so read the newest one.
const last = <T extends Element>(selector: string) =>
  [...document.querySelectorAll<T>(selector)].at(-1) ?? null
const panel = () => last<HTMLElement>('.dou-dialog-box')
const button = (name: 'confirm' | 'cancel') => last<HTMLButtonElement>(`.dou-dialog-box__${name}`)
const flush = () => new Promise((resolve) => setTimeout(resolve))

describe('dialog', () => {
  it('confirm resolves true on OK and labels an alertdialog', async () => {
    const answer = dialog.confirm({ title: '删除项目？', content: '此操作无法撤销。' })
    await settle()
    const box = panel()!
    expect(box.getAttribute('role')).toBe('alertdialog')
    expect(document.getElementById(box.getAttribute('aria-labelledby')!)?.textContent).toContain(
      '删除项目？',
    )
    expect(document.getElementById(box.getAttribute('aria-describedby')!)?.textContent).toContain(
      '此操作无法撤销。',
    )
    expect(button('confirm')?.textContent).toContain('确定')
    expect(document.activeElement).toBe(button('confirm'))
    button('confirm')!.click()
    expect(await answer).toBe(true)
  })

  it('confirm resolves false on cancel and on Escape', async () => {
    const first = dialog.confirm('确定吗？')
    await settle()
    button('cancel')!.click()
    expect(await first).toBe(false)

    const second = dialog.confirm('确定吗？')
    await settle()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(await second).toBe(false)
  })

  it('danger tone paints confirm red and focuses cancel first', async () => {
    void dialog.confirm({ title: '删除？', tone: 'danger' })
    await settle()
    expect(button('confirm')!.className).toContain('danger')
    expect(document.activeElement).toBe(button('cancel'))
    expect(panel()!.querySelector('.dou-dialog-box__icon svg')).not.toBeNull()
  })

  it('alert has a single button', async () => {
    const done = dialog.alert({ title: '已保存' })
    await settle()
    expect(button('cancel')).toBeNull()
    button('confirm')!.click()
    expect(await done).toBeUndefined()
  })

  it('keeps the dialog open while an async onConfirm runs, and after it rejects', async () => {
    let finish!: () => void
    let attempts = 0
    const answer = dialog.confirm({
      title: '发布？',
      onConfirm: () =>
        new Promise<void>((resolve, reject) => {
          attempts++
          if (attempts === 1) reject(new Error('nope'))
          else finish = resolve
        }),
    })
    await settle()
    button('confirm')!.click()
    await flush()
    await settle()
    expect(panel()).not.toBeNull()

    button('confirm')!.click()
    await settle()
    expect(button('confirm')!.getAttribute('aria-busy')).toBe('true')
    // Cancel is locked while the action runs.
    expect(button('cancel')!.disabled).toBe(true)
    finish()
    expect(await answer).toBe(true)
    expect(attempts).toBe(2)
  })

  it('prompt resolves the typed value, validates it, and null on cancel', async () => {
    const answer = dialog.prompt({
      title: '重命名',
      defaultValue: 'dou',
      validate: (value) => (value.length < 4 ? '至少 4 个字符' : true),
    })
    await settle()
    const input = panel()!.querySelector('input')!
    expect(input.value).toBe('dou')
    expect(document.activeElement).toBe(input)

    button('confirm')!.click()
    await flush()
    await settle()
    expect(panel()!.querySelector('[role="alert"]')?.textContent).toContain('至少 4 个字符')
    expect(input.getAttribute('aria-invalid')).toBe('true')

    input.value = 'dou-ui'
    input.dispatchEvent(new Event('input'))
    await settle()
    expect(panel()!.querySelector('[role="alert"]')).toBeNull()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(await answer).toBe('dou-ui')

    const cancelled = dialog.prompt('名称')
    await settle()
    button('cancel')!.click()
    expect(await cancelled).toBeNull()
  })

  it('close() on the handle and closeAll() answer cancel', async () => {
    const a = dialog.confirm('a')
    await settle()
    a.close()
    expect(await a).toBe(false)

    const b = dialog.prompt('b')
    const c = dialog.confirm('c')
    await settle()
    dialog.closeAll()
    expect(await b).toBeNull()
    expect(await c).toBe(false)
  })

  it('useDialog uses the locale of the app it is called in', async () => {
    let api!: DialogApi
    const host = document.createElement('div')
    document.body.append(host)
    createApp(
      defineComponent({
        setup() {
          api = useDialog()
          return () => h('div')
        },
      }),
    )
      .use(DouUI, { locale: en })
      .mount(host)
    void api.confirm('Sure?')
    await settle()
    expect(button('confirm')?.textContent).toContain('OK')
    expect(button('cancel')?.textContent).toContain('Cancel')
  })
})
