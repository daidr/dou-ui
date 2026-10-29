import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatHotkey, matchesHotkey, parseHotkey, useHotkey } from '../use-hotkey'
import type { UseHotkeyOptions } from '../use-hotkey'

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function host(hotkeys: string | string[], options?: UseHotkeyOptions) {
  const handler = vi.fn<(event: KeyboardEvent, hotkey: string) => void>()
  const wrapper = mount(
    defineComponent({
      setup() {
        useHotkey(hotkeys, handler, options)
        return () => h('input')
      },
    }),
    { attachTo: document.body },
  )
  return { handler, wrapper }
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('useHotkey', () => {
  it('parses combos, sequences and aliases', () => {
    expect(parseHotkey('Mod+K')).toEqual([['mod', 'k']])
    expect(parseHotkey('g i')).toEqual([['g'], ['i']])
    expect(parseHotkey('ctrl+esc')).toEqual([['ctrl', 'escape']])
    expect(parseHotkey('shift++')).toEqual([['shift', '+']])
  })

  it('reads mod as ⌘ on Apple platforms and Ctrl elsewhere', () => {
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    expect(matchesHotkey(event, 'mod+k', false)).toBe(true)
    expect(matchesHotkey(event, 'mod+k', true)).toBe(false)
    expect(
      matchesHotkey(new KeyboardEvent('keydown', { key: 'k', metaKey: true }), 'mod+k', true),
    ).toBe(true)
    expect(matchesHotkey(new KeyboardEvent('keydown', { key: 'k' }), 'mod+k', false)).toBe(false)
  })

  it('matches by physical key when a modifier changes the character', () => {
    const event = new KeyboardEvent('keydown', { key: 'å', code: 'KeyA', altKey: true })
    expect(matchesHotkey(event, 'alt+a', true)).toBe(true)
    const question = new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true })
    expect(matchesHotkey(question, '?')).toBe(true)
    expect(matchesHotkey(question, 'shift+/')).toBe(true)
  })

  it('fires on the document and skips typing in fields', () => {
    const { handler, wrapper } = host('ctrl+s')
    const event = press('s', { ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![1]).toBe('ctrl+s')
    expect(event.defaultPrevented).toBe(true)

    press('s', { ctrlKey: true }, wrapper.get('input').element)
    expect(handler).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('can fire inside fields when asked to', () => {
    const { handler, wrapper } = host('escape', { allowInInput: true, preventDefault: false })
    const event = press('Escape', {}, wrapper.get('input').element)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('follows sequences and gives up after the timeout', () => {
    vi.useFakeTimers()
    const { handler, wrapper } = host(['g i', 'g g'])
    press('g')
    press('Shift')
    press('i')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![1]).toBe('g i')

    press('g')
    press('x')
    press('i')
    expect(handler).toHaveBeenCalledTimes(1)

    press('g')
    vi.advanceTimersByTime(1500)
    press('i')
    expect(handler).toHaveBeenCalledTimes(1)

    press('g')
    press('g')
    expect(handler.mock.calls.at(-1)![1]).toBe('g g')
    wrapper.unmount()
  })

  it('can be turned off and unbinds on unmount', async () => {
    const enabled = ref(false)
    const { handler, wrapper } = host('k', { enabled })
    press('k')
    expect(handler).not.toHaveBeenCalled()
    enabled.value = true
    press('k')
    expect(handler).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    press('k')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('listens on a given target only', () => {
    const box = document.createElement('div')
    document.body.append(box)
    const { handler, wrapper } = host('k', { target: box })
    press('k')
    expect(handler).not.toHaveBeenCalled()
    press('k', {}, box)
    expect(handler).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

describe('formatHotkey', () => {
  it('names keys for the platform', () => {
    expect(formatHotkey('mod+k', true)).toEqual([['⌘', 'K']])
    expect(formatHotkey('mod+k', false)).toEqual([['Ctrl', 'K']])
    expect(formatHotkey('mod+shift+p', true)).toEqual([['⇧', '⌘', 'P']])
    expect(formatHotkey('g i')).toEqual([['G'], ['I']])
    expect(formatHotkey('esc', false)).toEqual([['Esc']])
  })
})
