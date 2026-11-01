import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from '../download'

describe('downloadBlob', () => {
  let revoke: ReturnType<typeof vi.fn<(url: string) => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    revoke = vi.fn<(url: string) => void>()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicks a link with the file name, then takes the link away', () => {
    const clicked: { href: string; download: string; inPage: boolean }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download, inPage: this.isConnected })
    })
    downloadBlob(new Blob(['a,b']), '门店.csv')
    expect(clicked).toEqual([{ href: 'blob:test', download: '门店.csv', inPage: true }])
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('frees the address 30 seconds later', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadBlob(new Blob(['x']), 'a.txt')
    vi.advanceTimersByTime(29_900)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(revoke).toHaveBeenCalledWith('blob:test')
  })
})
