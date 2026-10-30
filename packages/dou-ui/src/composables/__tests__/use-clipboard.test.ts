import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useClipboard } from '../../index'
import type { UseClipboardReturn } from '../../index'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function probe(duration?: number) {
  let clipboard!: UseClipboardReturn
  const Probe = defineComponent({
    setup() {
      clipboard = useClipboard({ duration })
      return () => null
    },
  })
  mount(Probe)
  return clipboard
}

describe('useClipboard', () => {
  it('writes the text and reports it for a while', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copy, copied } = probe(500)
    await copy('bun add dou-ui')
    expect(writeText).toHaveBeenCalledWith('bun add dou-ui')
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(500)
    expect(copied.value).toBe(false)
  })

  it('rejects and stays idle when copying fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    })
    const execCommand = vi.fn<() => boolean>(() => false)
    document.execCommand = execCommand
    const { copy, copied } = probe()
    await expect(copy('text')).rejects.toBeTruthy()
    expect(copied.value).toBe(false)
  })
})
