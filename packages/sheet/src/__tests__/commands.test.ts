import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  defineSheetCommand,
  defineSheetExtension,
  DouSheet,
  DouSheetToolbar,
  resolveSheetExtensions,
  useSheet,
  type SheetContext,
  type SheetExtension,
  type SheetSelection,
  type SheetWorkbook,
} from '../index'
import { mergeCommands } from '../core/commands'

const book = (): SheetWorkbook => ({
  sheets: [
    {
      name: '预算',
      cells: [
        ['项目', '金额'],
        ['场地', 1280],
        ['餐饮', 640.5],
      ],
      rowCount: 10,
      colCount: 4,
    },
  ],
})

function setup(props: Record<string, unknown> = {}, toolbar: Record<string, unknown> = {}) {
  const doc = ref(book())
  const selection = ref<SheetSelection>({
    active: { row: 1, col: 0 },
    ranges: [{ start: { row: 1, col: 0 }, end: { row: 2, col: 1 } }],
  })
  let context!: SheetContext
  const Probe = defineComponent(() => {
    context = useSheet()
    return () => null
  })
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouSheet,
          {
            modelValue: doc.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
            selection: selection.value,
            'onUpdate:selection': (value: SheetSelection) => (selection.value = value),
            ...props,
          },
          { header: () => [h(DouSheetToolbar, toolbar), h(Probe)] },
        ),
    ),
    { attachTo: document.body },
  )
  const button = (label: string) => wrapper.find(`.dou-sheet-toolbar [aria-label="${label}"]`)
  const grid = () => wrapper.find('[role="grid"]')
  return { wrapper, doc, button, grid, context: () => context }
}

describe('commands', () => {
  it('runs the built-in ones by name and tells their state', async () => {
    const { wrapper, doc, context } = setup()
    const { commands } = context()
    expect(commands.has('bold')).toBe(true)
    expect(commands.active('bold')).toBe(false)
    expect(commands.run('bold')).toBe(true)
    await nextTick()
    expect(commands.active('bold')).toBe(true)
    const style = (doc.value.sheets[0]!.cells[1]![0] as { style: string }).style
    expect(doc.value.styles![style]).toEqual({ bold: true })
    // `false` sets it off whatever it was
    commands.run('bold', false)
    await nextTick()
    expect(commands.active('bold')).toBe(false)
    expect(commands.get('merge')).toMatchObject({ label: '合并单元格', toggle: true })
    expect(commands.names()).toContain('sort.asc')
    expect(() => commands.run('nope')).toThrow(/no command "nope"/)
    wrapper.unmount()
  })

  it('says no in a read-only grid', () => {
    const { wrapper, context } = setup({ readonly: true })
    const { commands } = context()
    expect(commands.can('bold')).toBe(false)
    expect(commands.run('bold')).toBe(false)
    expect(commands.can('copy')).toBe(true)
    wrapper.unmount()
  })

  it('takes commands from extensions, and keys, menus and the toolbar refer to them', async () => {
    const calls: string[] = []
    const stamp = defineSheetExtension({
      name: 'stamp',
      commands: {
        'stamp.mark': defineSheetCommand({
          label: (m) => `${m.bold}标记`,
          shortcut: 'mod+shift+m',
          run: (ctx, arg) => {
            calls.push(String(arg ?? 'key'))
            ctx.transact((tr) => tr.setValue('C1', '已标记'))
          },
        }),
      },
      keymap: () => ({ 'mod+shift+m': 'stamp.mark' }),
      toolbar: () => [{ key: 'mark', command: 'stamp.mark' }],
    })
    const { wrapper, doc, button, grid } = setup({ extensions: [stamp] })
    // the toolbar puts it after the built-in tools, its label from the command
    await button('加粗标记').trigger('click')
    expect(doc.value.sheets[0]!.cells[0]![2]).toBe('已标记')
    await grid().trigger('keydown', { key: 'm', ctrlKey: true, shiftKey: true })
    expect(calls).toEqual(['key', 'key'])
    wrapper.unmount()
  })

  it('shows any command named in tools, and refuses names that are nothing', () => {
    const { wrapper, button } = setup({}, { tools: ['bold', 'print'] })
    expect(button('打印').exists()).toBe(true)
    expect(button('斜体').exists()).toBe(false)
    wrapper.unmount()
  })

  it('lets an extension replace a built-in command only with override', async () => {
    const plain: SheetExtension = {
      name: 'plain',
      commands: { bold: { label: '粗', run: () => false } },
    }
    expect(() =>
      mergeCommands(
        { bold: { label: 'b', run: () => {} } },
        resolveSheetExtensions([plain]).commands,
      ),
    ).toThrow(/override: true/)
    const twice = [
      { name: 'a', commands: { 'x.go': { label: 'a', run: () => {} } } },
      { name: 'b', commands: { 'x.go': { label: 'b', run: () => {} } } },
    ]
    expect(() => mergeCommands({}, resolveSheetExtensions(twice).commands)).toThrow(
      /both "a" and "b"/,
    )

    let ran = 0
    const loud = defineSheetExtension({
      name: 'loud',
      commands: { bold: { label: '强调', override: true, run: () => void ran++ } },
    })
    const { wrapper, doc, grid, button } = setup({ extensions: [loud] })
    await grid().trigger('keydown', { key: 'b', ctrlKey: true })
    await button('强调').trigger('click')
    expect(ran).toBe(2)
    expect(doc.value.styles).toBeUndefined()
    wrapper.unmount()
  })

  it('fills a menu item from its command', async () => {
    const extension = defineSheetExtension({
      name: 'menu-probe',
      contextMenu: () => [{ key: 'b', command: 'bold' }],
    })
    const { wrapper, grid } = setup({ extensions: [extension] })
    await grid().trigger('keydown', { key: 'F10', shiftKey: true })
    await nextTick()
    const labels = [...document.querySelectorAll('[role="menuitem"]')].map((el) =>
      el.textContent?.trim(),
    )
    expect(labels[0]).toContain('加粗')
    expect(labels.some((text) => text?.includes('剪切'))).toBe(true)
    wrapper.unmount()
  })

  it('keeps commands that can run usable in a read-only grid', () => {
    const view = defineSheetExtension({
      name: 'view',
      commands: { 'view.share': { label: '分享', run: () => {} } },
      toolbar: () => [{ key: 'share', command: 'view.share' }],
    })
    const { wrapper, button } = setup(
      { readonly: true, extensions: [view] },
      { tools: ['bold', 'print', 'share'] },
    )
    expect(button('加粗').attributes('disabled')).toBeDefined()
    expect(button('打印').attributes('disabled')).toBeUndefined()
    expect(button('打印').find('svg').exists()).toBe(true)
    expect(button('分享').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('refuses toolbar items whose key is taken', () => {
    const one = defineSheetExtension({
      name: 'one',
      toolbar: () => [{ key: 'bold', label: '粗', run: () => {} }],
    })
    expect(() => setup({ extensions: [one] })).toThrow(/toolbar item "bold"/)
    const item = { key: 'same', label: '同', run: () => {} }
    const twice = [
      { name: 'x', toolbar: () => [item] },
      { name: 'y', toolbar: () => [item] },
    ]
    expect(() => setup({ extensions: twice })).toThrow(/toolbar item "same"/)
    document.body.innerHTML = ''
  })

  it('draws a replaced built-in tool from its command', () => {
    const loud = defineSheetExtension({
      name: 'loud',
      commands: {
        bold: { label: '强调', override: true, active: () => true, run: () => {} },
      },
    })
    const { wrapper, button } = setup({ extensions: [loud] })
    expect(button('加粗').exists()).toBe(false)
    expect(button('强调').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('checks the commands keys name when the grid mounts', () => {
    const typo = defineSheetExtension({ name: 'typo', keymap: () => ({ 'mod+k': 'nope.go' }) })
    expect(() => setup({ extensions: [typo] })).toThrow(/"mod\+k" runs no command: "nope.go"/)
    document.body.innerHTML = ''
  })
})
