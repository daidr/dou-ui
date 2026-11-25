import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTruncatedTitle } from '../truncated-title'

function setWidths(el: HTMLElement, clientWidth: number, scrollWidth: number) {
  Object.defineProperties(el, {
    clientWidth: { configurable: true, get: () => clientWidth },
    scrollWidth: { configurable: true, get: () => scrollWidth },
  })
}

function makeRect(left: number, right: number): DOMRect {
  return {
    left,
    right,
    top: 0,
    bottom: 20,
    width: right - left,
    height: 20,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect
}

describe('resolveTruncatedTitle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('returns undefined for nullish elements', () => {
    expect(resolveTruncatedTitle(null, '标签')).toBeUndefined()
    expect(resolveTruncatedTitle(undefined, '标签')).toBeUndefined()
  })

  it('skips decorative nodes inside an aria-hidden="true" subtree', () => {
    const label = document.createElement('span')
    const wrapper = document.createElement('span')
    wrapper.setAttribute('aria-hidden', 'true')
    const inner = document.createElement('span')
    inner.style.overflow = 'hidden'
    inner.textContent = '●'
    const text = document.createElement('span')
    text.style.overflow = 'hidden'
    text.textContent = '核查度量前端灰度残留'
    wrapper.append(inner)
    label.append(wrapper, text)
    document.body.append(label)

    setWidths(label, 150, 150)
    setWidths(wrapper, 8, 14)
    setWidths(inner, 8, 14)
    setWidths(text, 130, 130)

    expect(resolveTruncatedTitle(label, '核查度量前端灰度残留')).toBeUndefined()
  })

  it('skips text-less overflowing nodes and does not fall back to explicitLabel', () => {
    const label = document.createElement('span')
    // e.g. <DouStatusDot ripple label="运行中" />: no aria-hidden, no textContent
    const dot = document.createElement('span')
    dot.setAttribute('role', 'img')
    dot.setAttribute('aria-label', '运行中')
    dot.style.overflow = 'hidden'
    const icon = document.createElement('span')
    icon.style.overflow = 'hidden'
    icon.innerHTML = '<svg><title>状态图标</title></svg>'
    const blank = document.createElement('span')
    blank.style.overflow = 'hidden'
    blank.textContent = '   '
    const hiddenOnly = document.createElement('span')
    hiddenOnly.style.overflow = 'hidden'
    const hiddenGlyph = document.createElement('span')
    hiddenGlyph.setAttribute('aria-hidden', 'true')
    hiddenGlyph.textContent = '★'
    hiddenOnly.append(hiddenGlyph)
    const text = document.createElement('span')
    text.style.overflow = 'hidden'
    text.textContent = '简短标题'

    label.append(dot, icon, blank, hiddenOnly, text)
    document.body.append(label)

    setWidths(label, 160, 160)
    setWidths(dot, 8, 14)
    setWidths(icon, 16, 22)
    setWidths(blank, 10, 20)
    setWidths(hiddenOnly, 12, 20)
    setWidths(text, 60, 60)

    expect(resolveTruncatedTitle(label, '简短标题')).toBeUndefined()
  })

  it('skips overflow-x: visible nodes that overflow visually without clipping', () => {
    const label = document.createElement('span')
    const rippleContainer = document.createElement('span')
    rippleContainer.style.overflowX = 'visible'
    rippleContainer.textContent = '运行中'
    const shorthandVisible = document.createElement('span')
    shorthandVisible.style.overflow = 'visible'
    shorthandVisible.textContent = '在线'
    label.append(rippleContainer, shorthandVisible)
    document.body.append(label)

    setWidths(label, 120, 120)
    setWidths(rippleContainer, 48, 56)
    setWidths(shorthandVisible, 32, 40)

    expect(resolveTruncatedTitle(label, '运行中')).toBeUndefined()
  })

  it('does not let a leading ripple status dot shadow a following truncated text node', () => {
    const label = document.createElement('span')
    const dotWrap = document.createElement('span')
    dotWrap.setAttribute('aria-hidden', 'true')
    dotWrap.style.overflowX = 'visible'
    const dot = document.createElement('span')
    dot.setAttribute('aria-hidden', 'true')
    dot.style.overflowX = 'visible'
    dotWrap.append(dot)

    const title = document.createElement('span')
    title.style.overflowX = 'clip'
    title.textContent = '实际截断的讨论串完整标题'
    label.append(dotWrap, title)
    document.body.append(label)

    setWidths(label, 140, 140)
    setWidths(dotWrap, 8, 14)
    setWidths(dot, 8, 14)
    setWidths(title, 120, 240)

    expect(resolveTruncatedTitle(label, '备用 explicitLabel')).toBe('实际截断的讨论串完整标题')
  })

  it('respects a following truncated text node that already carries its own title', () => {
    const label = document.createElement('span')
    const dotWrap = document.createElement('span')
    dotWrap.setAttribute('aria-hidden', 'true')
    dotWrap.style.overflowX = 'visible'
    const dot = document.createElement('span')
    dot.setAttribute('aria-hidden', 'true')
    dotWrap.append(dot)

    const title = document.createElement('span')
    title.style.overflow = 'hidden'
    title.title = '业务自定义提示'
    title.textContent = '自带 title 的截断标题'
    label.append(dotWrap, title)
    document.body.append(label)

    setWidths(label, 140, 140)
    setWidths(dotWrap, 8, 14)
    setWidths(dot, 8, 14)
    setWidths(title, 100, 220)

    expect(resolveTruncatedTitle(label, '备用 explicitLabel')).toBeUndefined()
  })

  it('skips a truncated sibling with its own title and still resolves a later truncated text node', () => {
    const label = document.createElement('span')
    const prefix = document.createElement('span')
    prefix.style.overflow = 'hidden'
    prefix.title = '前置模块说明'
    prefix.textContent = '前置模块长名称'
    const title = document.createElement('span')
    title.style.overflow = 'hidden'
    title.textContent = '后置主标题截断文本'
    label.append(prefix, title)
    document.body.append(label)

    setWidths(label, 160, 160)
    setWidths(prefix, 60, 120)
    setWidths(title, 80, 180)

    expect(resolveTruncatedTitle(label, '备用标题')).toBe('后置主标题截断文本')
  })

  it('ignores outer wrapper overflow when its deepest truncated child owns a title', () => {
    const label = document.createElement('span')
    const wrap = document.createElement('span')
    wrap.style.overflow = 'hidden'
    const leaf = document.createElement('span')
    leaf.style.overflow = 'hidden'
    leaf.title = '内层自带提示'
    leaf.textContent = '截断子标题'
    const badge = document.createElement('span')
    badge.textContent = '9'
    wrap.append(leaf, badge)
    label.append(wrap)
    document.body.append(label)

    setWidths(label, 120, 120)
    setWidths(wrap, 100, 180)
    setWidths(leaf, 80, 160)

    expect(resolveTruncatedTitle(label, '备用标题')).toBeUndefined()
  })

  it('ignores root overflow when root has no visible text or uses overflow-x: visible', () => {
    const textlessRoot = document.createElement('span')
    const dot = document.createElement('span')
    dot.setAttribute('aria-hidden', 'true')
    textlessRoot.append(dot)
    document.body.append(textlessRoot)
    setWidths(textlessRoot, 8, 14)
    setWidths(dot, 8, 14)
    expect(resolveTruncatedTitle(textlessRoot, '纯装饰标签')).toBeUndefined()

    const visibleRoot = document.createElement('span')
    visibleRoot.style.overflowX = 'visible'
    visibleRoot.textContent = '非裁剪根节点文本'
    document.body.append(visibleRoot)
    setWidths(visibleRoot, 60, 120)
    expect(resolveTruncatedTitle(visibleRoot, '非裁剪根节点文本')).toBeUndefined()
  })

  it('ignores false root overflow caused by a trailing ripple node when text fits inside content box', () => {
    const label = document.createElement('span')
    label.style.overflowX = 'clip'
    const title = document.createElement('span')
    title.style.overflow = 'hidden'
    title.textContent = '核查度量'
    const dot = document.createElement('span')
    dot.setAttribute('aria-hidden', 'true')
    dot.style.overflowX = 'visible'
    label.append(title, dot)
    document.body.append(label)

    setWidths(label, 70, 76)
    setWidths(title, 56, 56)
    setWidths(dot, 8, 14)

    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(makeRect(8, 78))
    let textRight = 64
    vi.spyOn(document, 'createRange').mockImplementation(
      () =>
        ({
          setStart: () => {},
          setEnd: () => {},
          getBoundingClientRect: () => makeRect(8, textRight),
        }) as unknown as Range,
    )

    // text fits in [8, 78]: trailing ripple caused scrollWidth 76 > clientWidth 70
    expect(resolveTruncatedTitle(label, '核查度量')).toBeUndefined()

    // text actually exceeds content box [8, 78]
    textRight = 140
    expect(resolveTruncatedTitle(label, '核查度量完整标题')).toBe('核查度量完整标题')
  })

  it('strips aria-hidden glyphs while preserving spaces between visible text segments', () => {
    const label = document.createElement('span')
    label.style.overflowX = 'clip'
    const hidden = document.createElement('span')
    hidden.setAttribute('aria-hidden', 'true')
    hidden.textContent = '★'
    const partA = document.createElement('span')
    partA.textContent = 'Hello '
    const partB = document.createElement('span')
    partB.textContent = 'World'
    label.append(hidden, partA, partB)
    document.body.append(label)

    setWidths(label, 40, 120)
    expect(resolveTruncatedTitle(label)).toBe('Hello World')
  })
})
