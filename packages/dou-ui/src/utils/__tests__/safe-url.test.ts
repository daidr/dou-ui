import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkedUrl, opensNewTab, safeUrl } from '../safe-url'

describe('safeUrl', () => {
  it('keeps safe addresses', () => {
    for (const url of [
      'https://weather.sh.cn/a?b=c:d',
      'HTTP://x.com',
      'mailto:daidr@daidr.me',
      'tel:+8621000000',
      '/docs/a:b',
      './a',
      '../a',
      'a/b:c',
      '?q=a:b',
      '#a:b',
      'page.html',
      '2024:年报.html',
      '第1章:概述.html',
    ]) {
      expect(safeUrl(url)).toBe(url)
    }
  })

  it('drops other schemes, however they are written', () => {
    for (const url of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '\u0000javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(safeUrl(url)).toBeUndefined()
    }
  })

  it('treats empty as no address', () => {
    expect(safeUrl(undefined)).toBeUndefined()
    expect(safeUrl('')).toBeUndefined()
  })
})

describe('opensNewTab', () => {
  it('is false only for mailto and tel', () => {
    expect(opensNewTab('https://a.com')).toBe(true)
    expect(opensNewTab('/a')).toBe(true)
    expect(opensNewTab('MAILTO:a@b.com')).toBe(false)
    expect(opensNewTab(' tel:+8621000000')).toBe(false)
  })
})

describe('checkedUrl', () => {
  afterEach(() => vi.restoreAllMocks())

  it('warns once with the component name when it drops an address', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(checkedUrl('DouProbe', 'javascript:void(1)')).toBeUndefined()
    checkedUrl('DouProbe', 'javascript:void(1)')
    expect(checkedUrl('DouProbe', 'https://a.com')).toBe('https://a.com')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatch(
      /^\[dou-ui\] DouProbe: `javascript:void\(1\)` is not a safe url/,
    )
  })
})
