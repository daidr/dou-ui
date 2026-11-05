import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouChatInput } from '../../../index'
import { findToken } from '../chat-input'

/** Waits out a `searchDelay` of 100 ms. */
async function wait() {
  vi.advanceTimersByTime(100)
  await nextTick()
}

/** A chat input whose `@` options are looked up elsewhere. */
async function remote() {
  vi.useFakeTimers()
  const wrapper = mount(DouChatInput, {
    props: {
      modelValue: '',
      filter: { '@': false },
      searchDelay: 100,
      teleport: false,
      onSearch: () => {},
    },
    attachTo: document.body,
  })
  const textarea = wrapper.get('textarea')
  const type = async (text: string, caret = text.length) => {
    await wrapper.setProps({ modelValue: text })
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(caret, caret)
    await textarea.trigger('keyup')
  }
  const answer = (...values: string[]) =>
    wrapper.setProps({ mentions: values.map((value) => ({ value })) })
  const isStale = () => wrapper.get('[role="listbox"]').classes().includes('is-stale')
  const enter = () => textarea.trigger('keydown', { key: 'Enter' })
  return { wrapper, type, answer, isStale, enter }
}

describe('DouChatInput', () => {
  it('sends on Enter but not on Shift+Enter or while composing', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: '你好' } })
    const textarea = wrapper.get('textarea')
    expect(textarea.attributes('placeholder')).toBe('发送消息')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    await textarea.trigger('keydown', { key: 'Enter', isComposing: true })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toEqual([['你好']])
  })

  it('sends on Ctrl / ⌘ + Enter with `mod-enter`', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: 'hi', submitOn: 'mod-enter' } })
    const textarea = wrapper.get('textarea')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await textarea.trigger('keydown', { key: 'Enter', metaKey: true })
    expect(wrapper.emitted('submit')).toEqual([['hi']])
  })

  it('does not send blank text unless `canSubmit` says so', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: '  ' } })
    const button = wrapper.get('.dou-chat-input__submit')
    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await wrapper.setProps({ canSubmit: true })
    await wrapper.get('.dou-chat-input__submit').trigger('click')
    expect(wrapper.emitted('submit')).toEqual([['  ']])
  })

  it('stops while loading, but sends again once something is typed', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: '', loading: true } })
    const button = wrapper.get('.dou-chat-input__submit')
    expect(button.attributes('aria-label')).toBe('停止生成')
    await button.trigger('click')
    expect(wrapper.emitted('stop')).toHaveLength(1)

    await wrapper.setProps({ modelValue: '顺便查下天气' })
    expect(wrapper.get('.dou-chat-input__submit').attributes('aria-label')).toBe('发送')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toEqual([['顺便查下天气']])
  })

  it('offers commands after a leading slash', async () => {
    const wrapper = mount(DouChatInput, {
      props: {
        modelValue: '',
        teleport: false,
        'onUpdate:modelValue': (value: unknown): void => {
          void wrapper.setProps({ modelValue: value as string })
        },
        commands: [
          { value: 'summarize', label: '总结' },
          { value: 'translate', label: '翻译' },
        ],
      },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('/翻')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(2, 2)
    await textarea.trigger('keyup')
    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toContain('/翻译')
    expect(textarea.attributes('aria-expanded')).toBe('true')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('command')).toEqual([[{ value: 'translate', label: '翻译' }]])
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.props('modelValue')).toBe('')
    wrapper.unmount()
  })

  it('inserts mentions after an at sign', async () => {
    const wrapper = mount(DouChatInput, {
      props: {
        modelValue: '',
        teleport: false,
        'onUpdate:modelValue': (value: unknown): void => {
          void wrapper.setProps({ modelValue: value as string })
        },
        mentions: [{ value: '周报.md' }, { value: '戴兜' }],
      },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('看下 @周')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(5, 5)
    await textarea.trigger('keyup')
    await wrapper.get('[role="option"]').trigger('click')
    expect(wrapper.props('modelValue')).toBe('看下 @周报.md ')
    expect(wrapper.emitted('mention')).toEqual([[{ value: '周报.md' }]])
    wrapper.unmount()
  })

  describe('matching', () => {
    const snippets = [
      { value: 's_01', label: '周报模板' },
      { value: 's_02', label: '会议纪要', keywords: ['huiyi'] },
      { value: ':manage', label: '管理片段' },
    ]
    async function typed(text: string, props: Record<string, unknown> = {}) {
      const wrapper = mount(DouChatInput, {
        props: { modelValue: text, teleport: false, commands: snippets, ...props },
        attachTo: document.body,
      })
      const textarea = wrapper.get('textarea')
      ;(textarea.element as HTMLTextAreaElement).setSelectionRange(text.length, text.length)
      await textarea.trigger('keyup')
      const labels = wrapper.findAll('[role="option"]').map((option) => option.text())
      wrapper.unmount()
      return labels
    }

    it('matches the label and keywords, not a value that has a label', async () => {
      expect(await typed('/s')).toEqual([])
      expect(await typed('/m')).toEqual([])
      expect(await typed('/hui')).toEqual(['/会议纪要'])
      expect(await typed('/周')).toEqual(['/周报模板'])
    })

    it('matches the value when there is no label', async () => {
      expect(await typed('@zh', { mentions: [{ value: 'zhou.md' }, { value: 'dai.md' }] })).toEqual(
        ['@zhou.md'],
      )
    })

    it('matches the description too', async () => {
      const mentions = [
        { value: 'a.md', description: 'docs/上海' },
        { value: 'b.md', description: 'src' },
      ]
      expect(await typed('@上海', { mentions })).toEqual(['@a.mddocs/上海'])
    })

    it('sets the filter apart per trigger', async () => {
      const mentions = [{ value: 'zhou.md' }, { value: 'dai.md' }]
      const filter = { '@': false }
      expect(await typed('@x', { mentions, filter })).toHaveLength(2)
      expect(await typed('/周', { mentions, filter })).toEqual(['/周报模板'])
    })

    it('takes a filter, or shows everything with `filter: false`', async () => {
      expect(await typed('/x', { filter: false })).toHaveLength(3)
      expect(
        await typed('/s_', {
          filter: (option: { value: string }, query: string, trigger: string) =>
            trigger === '/' && option.value.startsWith(query),
        }),
      ).toEqual(['/周报模板', '/会议纪要'])
    })
  })

  it('emits search with the typed query once typing pauses', async () => {
    vi.useFakeTimers()
    const wrapper = mount(DouChatInput, {
      props: { modelValue: '', searchDelay: 200 },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    const type = async (text: string) => {
      await wrapper.setProps({ modelValue: text })
      ;(textarea.element as HTMLTextAreaElement).setSelectionRange(text.length, text.length)
      await textarea.trigger('keyup')
    }
    await type('看 @')
    await type('看 @sr')
    vi.advanceTimersByTime(100)
    await type('看 @src')
    expect(wrapper.emitted('search')).toBeUndefined()
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('search')).toEqual([['src', '@']])
    await type('看 @src 好')
    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('search')).toHaveLength(1)
    await type('/')
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('search')![1]).toEqual(['', '/'])
    wrapper.unmount()
    vi.useRealTimers()
  })

  describe('results looked up elsewhere', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not pick from results that answer an older query', async () => {
      const { wrapper, type, answer, isStale, enter } = await remote()
      await type('@')
      await wait()
      await answer('docs/需求.md', 'src/set.ts')
      expect(isStale()).toBe(false)
      await type('@set')
      expect(isStale()).toBe(true)
      await enter()
      expect(wrapper.emitted('mention')).toBeUndefined()
      expect(wrapper.emitted('submit')).toBeUndefined()
      await wait()
      await answer('src/set.ts')
      expect(isStale()).toBe(false)
      await enter()
      expect(wrapper.emitted('mention')).toEqual([[{ value: 'src/set.ts' }]])
      wrapper.unmount()
    })

    it('takes a late answer for the query it was asked for', async () => {
      const { wrapper, type, answer, isStale, enter } = await remote()
      await type('@s')
      await wait()
      // "se" is typed, its search still waits, and the answer for "s" arrives
      await type('@se')
      await answer('src/a.ts', 'docs/se.md')
      expect(isStale()).toBe(true)
      await enter()
      expect(wrapper.emitted('mention')).toBeUndefined()
      wrapper.unmount()
    })

    it('asks again for the same text at another trigger', async () => {
      const { wrapper, type, answer, isStale } = await remote()
      await type('@a x @a', 2)
      await wait()
      await answer('a.ts')
      await type('@a x @a')
      expect(isStale()).toBe(true)
      await wait()
      expect(wrapper.emitted('search')).toEqual([
        ['a', '@'],
        ['a', '@'],
      ])
      await answer('a.ts')
      expect(isStale()).toBe(false)
      wrapper.unmount()
    })

    it('treats a list put in before any search as fixed', async () => {
      const { wrapper, type, answer, enter } = await remote()
      await answer('戴兜', '上海')
      await type('@d')
      expect(wrapper.get('[role="listbox"]').classes()).not.toContain('is-stale')
      await enter()
      expect(wrapper.emitted('mention')).toEqual([[{ value: '戴兜' }]])
      wrapper.unmount()
    })
  })

  it('never treats a list that is not replaced as stale', async () => {
    const wrapper = mount(DouChatInput, {
      props: { modelValue: '', mentions: [{ value: '戴兜' }], filter: false, teleport: false },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    await wrapper.setProps({ modelValue: '@x' })
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(2, 2)
    await textarea.trigger('keyup')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('mention')).toEqual([[{ value: '戴兜' }]])
    wrapper.unmount()
  })

  it('never goes stale without a search listener, even on a new array each render', async () => {
    vi.useFakeTimers()
    const files = ['戴兜.md', '上海.md']
    const wrapper = mount(DouChatInput, {
      props: {
        modelValue: '',
        mentions: files.map((value) => ({ value })),
        filter: false,
        teleport: false,
        'onUpdate:modelValue': (value: unknown): void => {
          // the parent renders again and passes an equal, new array
          void wrapper.setProps({
            modelValue: value as string,
            mentions: files.map((file) => ({ value: file })),
          })
        },
      },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    const el = textarea.element as HTMLTextAreaElement
    for (const text of ['@', '@d', '@da']) {
      el.value = text
      el.setSelectionRange(text.length, text.length)
      await textarea.trigger('input')
      await textarea.trigger('keyup')
      await vi.advanceTimersByTimeAsync(300)
    }
    const listbox = wrapper.get('[role="listbox"]')
    expect(listbox.classes()).not.toContain('is-stale')
    expect(listbox.attributes('aria-busy')).toBeUndefined()
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('mention')).toEqual([[{ value: '戴兜.md' }]])
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('waits for an input method to finish and stays quiet once dismissed', async () => {
    vi.useFakeTimers()
    const wrapper = mount(DouChatInput, {
      props: {
        modelValue: '',
        mentions: [{ value: '戴兜' }],
        teleport: false,
        'onUpdate:modelValue': (value: unknown): void => {
          void wrapper.setProps({ modelValue: value as string })
        },
      },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    const el = textarea.element as HTMLTextAreaElement
    const type = async (text: string) => {
      await wrapper.setProps({ modelValue: text })
      el.setSelectionRange(text.length, text.length)
      await textarea.trigger('keyup')
    }
    // an input method spells "@hu" before it puts down "@戴"
    await textarea.trigger('compositionstart')
    for (const text of ['@h', '@hu']) {
      el.value = text
      await textarea.trigger('input')
      await textarea.trigger('keyup', { keyCode: 229 })
    }
    vi.advanceTimersByTime(400)
    expect(wrapper.emitted('search')).toBeUndefined()
    el.value = '@戴'
    el.setSelectionRange(2, 2)
    await textarea.trigger('compositionend')
    vi.advanceTimersByTime(400)
    expect(wrapper.emitted('search')).toEqual([['戴', '@']])
    await textarea.trigger('keydown', { key: 'Escape' })
    await type('@戴兜')
    vi.advanceTimersByTime(400)
    expect(wrapper.emitted('search')).toHaveLength(1)
    await type('@戴兜 @')
    vi.advanceTimersByTime(400)
    expect(wrapper.emitted('search')).toEqual([
      ['戴', '@'],
      ['', '@'],
    ])
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('closes the menu on Escape', async () => {
    const wrapper = mount(DouChatInput, {
      props: { modelValue: '@', mentions: [{ value: '戴兜' }], teleport: false },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(1, 1)
    await textarea.trigger('keyup')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    await textarea.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('finds the token at the caret', () => {
    expect(findToken('/sum', 4)).toEqual({ trigger: '/', query: 'sum', start: 0, end: 4 })
    expect(findToken('a /sum', 6)).toBeNull()
    expect(findToken('问 @戴', 4)).toEqual({ trigger: '@', query: '戴', start: 2, end: 4 })
    expect(findToken('mail@x', 6)).toBeNull()
  })

  it('updates the model and renders the slots', async () => {
    const wrapper = mount(DouChatInput, {
      props: { modelValue: '' },
      slots: { header: () => '附件', actions: () => '工具' },
    })
    await wrapper.get('textarea').setValue('写一首诗')
    expect(wrapper.emitted('update:modelValue')).toEqual([['写一首诗']])
    expect(wrapper.get('.dou-chat-input__header').text()).toBe('附件')
    expect(wrapper.get('.dou-chat-input__actions').text()).toBe('工具')
  })

  it('hands dropped files over', async () => {
    const wrapper = mount(DouChatInput)
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await wrapper.trigger('drop', { dataTransfer: { files: [file], types: ['Files'] } })
    expect(wrapper.emitted('attach')).toEqual([[[file]]])
  })

  it('renders the menu on top of the page, so a clipping parent cannot hide it', async () => {
    const wrapper = mount(DouChatInput, {
      props: { modelValue: '', commands: [{ value: 'summarize', label: '总结' }] },
      attachTo: document.body,
    })
    await wrapper.get('textarea').setValue('/')
    await wrapper.get('textarea').trigger('keyup')
    const menu = document.querySelector<HTMLElement>('.dou-chat-input__menu')!
    expect(menu.closest('.dou-chat-input')).toBeNull()
    expect(menu.style.position).toBe('fixed')
    expect(Number(menu.style.zIndex)).toBeGreaterThan(0)
    expect(wrapper.get('textarea').attributes('aria-controls')).toBe(menu.id)

    // a press outside closes it
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(document.querySelector('.dou-chat-input__menu')).toBeNull()
    wrapper.unmount()
  })

  describe('menu navigation', () => {
    const commands = [
      { value: 'summarize', label: '总结' },
      { value: 'translate', label: '翻译' },
      { value: 'archive', label: '归档', disabled: true },
      { value: 'plan', label: '计划' },
    ]

    async function open() {
      const wrapper = mount(DouChatInput, {
        props: {
          modelValue: '',
          teleport: false,
          'onUpdate:modelValue': (value: unknown): void => {
            void wrapper.setProps({ modelValue: value as string })
          },
          commands,
        },
        attachTo: document.body,
      })
      const textarea = wrapper.get('textarea')
      await textarea.setValue('/')
      ;(textarea.element as HTMLTextAreaElement).setSelectionRange(1, 1)
      await textarea.trigger('keyup')
      // A key press as the browser delivers it: keydown, then keyup.
      const press = async (key: string) => {
        await textarea.trigger('keydown', { key })
        await textarea.trigger('keyup', { key })
      }
      const active = () =>
        wrapper.findAll('[role="option"]').findIndex((o) => o.classes('is-active'))
      return { wrapper, textarea, press, active }
    }

    it('moves down and up, and keeps the highlight through keyup', async () => {
      const { wrapper, textarea, press, active } = await open()
      expect(active()).toBe(0)
      await press('ArrowDown')
      expect(active()).toBe(1)
      expect(textarea.attributes('aria-activedescendant')).toBe(
        wrapper.findAll('[role="option"]')[1]!.attributes('id'),
      )
      await press('ArrowUp')
      expect(active()).toBe(0)
      wrapper.unmount()
    })

    it('skips disabled options and wraps at both ends', async () => {
      const { wrapper, press, active } = await open()
      await press('ArrowDown')
      await press('ArrowDown')
      expect(active()).toBe(3)
      await press('ArrowDown')
      expect(active()).toBe(0)
      await press('ArrowUp')
      expect(active()).toBe(3)
      wrapper.unmount()
    })

    it('picks the highlighted option on Enter', async () => {
      const { wrapper, press } = await open()
      await press('ArrowDown')
      await press('Enter')
      expect(wrapper.emitted('command')).toEqual([[commands[1]]])
      expect(wrapper.emitted('submit')).toBeUndefined()
      wrapper.unmount()
    })

    it('closes on Escape and stays closed until the token changes', async () => {
      const { wrapper, textarea, press } = await open()
      await press('Escape')
      expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
      await textarea.setValue('/t')
      ;(textarea.element as HTMLTextAreaElement).setSelectionRange(2, 2)
      await textarea.trigger('keyup')
      expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('follows the pointer but ignores disabled options', async () => {
      const { wrapper, press, active } = await open()
      const options = wrapper.findAll('[role="option"]')
      await options[3]!.trigger('mouseenter')
      expect(active()).toBe(3)
      await options[2]!.trigger('mouseenter')
      expect(active()).toBe(3)
      await press('ArrowUp')
      expect(active()).toBe(1)
      wrapper.unmount()
    })

    it('starts again from the first option when the list changes', async () => {
      const { wrapper, textarea, press, active } = await open()
      await press('ArrowDown')
      await textarea.setValue('/计')
      ;(textarea.element as HTMLTextAreaElement).setSelectionRange(2, 2)
      await textarea.trigger('keyup')
      expect(wrapper.findAll('[role="option"]').map((o) => o.text())).toEqual(['/计划'])
      expect(active()).toBe(0)
      wrapper.unmount()
    })

    it('keeps the highlight when the parent passes an equal list again', async () => {
      const { wrapper, press, active } = await open()
      await press('ArrowDown')
      await wrapper.setProps({ commands: commands.map((c) => ({ ...c })) })
      expect(active()).toBe(1)
      wrapper.unmount()
    })
  })
})
