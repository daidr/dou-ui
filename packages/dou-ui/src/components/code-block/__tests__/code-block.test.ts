import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouCodeBlock, DouConfigProvider } from '../../../index'
import type { CodeBlockExpose, CodeBlockHighlighter } from '../../../index'
import { htmlLines, parseLines } from '../lines'

const code = 'const a = 1\n\nconsole.log(a)\n'

/** Output shaped like shiki's `codeToHtml` with two themes. */
const shikiLike: CodeBlockHighlighter = (source, lang) =>
  `<pre class="shiki shiki-themes" tabindex="0"><code>${source
    .replace(/\n$/, '')
    .split('\n')
    .map(
      (line) =>
        `<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">${line}</span></span>`,
    )
    .join('\n')}</code></pre><!-- ${lang} -->`

const lineTexts = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.dou-code-block__line').map((line) => line.element.textContent)

describe('lines', () => {
  it('splits highlighted HTML into lines and reads line lists', () => {
    expect(
      htmlLines('<pre><code><span class="line">a</span>\n<span class="line">b</span></code></pre>'),
    ).toEqual(['<span class="line">a</span>', '<span class="line">b</span>'])
    expect([...parseLines('1,3-5')]).toEqual([1, 3, 4, 5])
    expect([...parseLines('{2}')]).toEqual([2])
    expect([...parseLines([7])]).toEqual([7])
  })
})

describe('DouCodeBlock', () => {
  it('shows plain code line by line without a highlighter', () => {
    const wrapper = mount(DouCodeBlock, { props: { code: '<b>\n  x' } })
    expect(lineTexts(wrapper)).toEqual(['<b>', '  x'])
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('.dou-code-block__header').exists()).toBe(false)
    expect(wrapper.find('.dou-copy-button').exists()).toBe(true)
  })

  it('takes shiki-shaped HTML, numbers and marks lines', () => {
    const wrapper = mount(DouCodeBlock, {
      props: {
        code,
        lang: 'ts',
        filename: 'main.ts',
        highlight: shikiLike,
        lineNumbers: true,
        startLine: 10,
        highlightLines: '11-12',
      },
    })
    expect(lineTexts(wrapper)).toEqual(['const a = 1', '', 'console.log(a)'])
    expect(wrapper.get('.dou-code-block__line span span').attributes('style')).toContain(
      '--shiki-dark',
    )
    expect(wrapper.findAll('.dou-code-block__number').map((n) => n.text())).toEqual([
      '10',
      '11',
      '12',
    ])
    expect(
      wrapper.findAll('.dou-code-block__row').map((row) => row.classes().includes('is-marked')),
    ).toEqual([false, true, true])
    expect(wrapper.get('.dou-code-block__title').text()).toBe('main.ts')
  })

  it('fills in an async highlighter, keeping only the latest answer', async () => {
    const wrapper = mount(DouCodeBlock, {
      props: {
        code: 'a',
        highlight: (source: string) =>
          Promise.resolve(`<span class="line"><i>${source}</i></span>`),
      },
    })
    expect(wrapper.find('i').exists()).toBe(false)
    await flushPromises()
    expect(wrapper.get('i').text()).toBe('a')
    await wrapper.setProps({ code: 'b' })
    await flushPromises()
    expect(wrapper.get('i').text()).toBe('b')
  })

  it('reads the highlighter from ConfigProvider defaults', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { defaults: { DouCodeBlock: { highlight: shikiLike } } },
      slots: { default: () => h(DouCodeBlock, { code: 'x', lang: 'ts' }) },
    })
    expect(wrapper.find('.dou-code-block__line .line').exists()).toBe(true)
  })

  it('folds long code behind a button', async () => {
    const wrapper = mount(DouCodeBlock, {
      props: { code: Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n'), maxLines: 5 },
    })
    const toggle = wrapper.get('.dou-code-block__toggle')
    expect(wrapper.classes()).toContain('is-folded')
    expect(toggle.text()).toBe('展开全部 12 行')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(wrapper.classes()).not.toContain('is-folded')
    expect(toggle.text()).toBe('收起')
  })

  it('positions the headless copy button with higher specificity than .dou-copy-button', () => {
    const wrapper = mount(DouCodeBlock, { props: { code: 'echo hi' } })
    const copy = wrapper.get('.dou-code-block__copy')
    expect(copy.element.parentElement).toBe(wrapper.element)
    expect(copy.classes()).toContain('dou-copy-button')

    const css = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../theme/src/components/code-block.css',
      ),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')

    const copyStart = css.indexOf('.dou-code-block > .dou-code-block__copy {')
    expect(copyStart).toBeGreaterThan(-1)
    const copyBlock = css.slice(copyStart, css.indexOf('.dou-code-block:is(:hover', copyStart))
    expect(copyBlock).toMatch(/position:\s*absolute/)
    expect(copyBlock).toMatch(/top:\s*6px/)
    expect(copyBlock).toMatch(
      /right:\s*calc\(6px \+ var\(--dou-code-block-scrollbar-width, 0px\)\)/,
    )
    expect(copyBlock).toMatch(/transition-property:[^;]*opacity/)
  })

  it('supports maxHeight vertical scrolling and offsets the copy button for the scrollbar', async () => {
    const wrapper = mount(DouCodeBlock, {
      props: { code: 'line 1\nline 2', maxHeight: 200 },
    })
    expect(wrapper.classes()).toContain('is-scrollable')
    expect(wrapper.attributes('style')).toContain('--dou-code-block-max-height: 200px')
    const body = wrapper.get('.dou-code-block__body')
    expect(body.attributes('tabindex')).toBe('0')

    Object.defineProperty(body.element, 'offsetWidth', { configurable: true, value: 320 })
    Object.defineProperty(body.element, 'clientWidth', { configurable: true, value: 305 })
    await wrapper.setProps({ maxHeight: '16rem' })
    await nextTick()
    expect(wrapper.attributes('style')).toContain('--dou-code-block-max-height: 16rem')
    expect(wrapper.attributes('style')).toContain('--dou-code-block-scrollbar-width: 15px')

    await wrapper.setProps({ maxHeight: undefined })
    await nextTick()
    expect(wrapper.classes()).not.toContain('is-scrollable')
    expect(body.attributes('tabindex')).toBeUndefined()
    expect(wrapper.attributes('style') ?? '').not.toContain('--dou-code-block-scrollbar-width')

    const css = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../theme/src/components/code-block.css',
      ),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const scrollStart = css.indexOf('.dou-code-block.is-scrollable .dou-code-block__body {')
    expect(scrollStart).toBeGreaterThan(-1)
    const scrollBlock = css.slice(
      scrollStart,
      css.indexOf('.dou-code-block.is-folded', scrollStart),
    )
    expect(scrollBlock).toMatch(/max-height:\s*var\(--dou-code-block-max-height\)/)
    expect(scrollBlock).toMatch(/overflow-y:\s*auto/)
  })

  it('auto-follows streaming output, pauses on manual scroll up, and resumes at bottom or via scrollToBottom', async () => {
    const wrapper = mount(DouCodeBlock, {
      props: {
        code: 'line 1\nline 2\nline 3',
        maxHeight: 160,
        streaming: true,
      },
    })
    const vm = wrapper.vm as unknown as CodeBlockExpose
    const body = wrapper.get('.dou-code-block__body')
    expect(vm.body).toBe(body.element)

    let scrollHeight = 400
    Object.defineProperty(body.element, 'clientHeight', { configurable: true, get: () => 160 })
    Object.defineProperty(body.element, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    })

    // Appending code while following pins to the bottom.
    scrollHeight = 460
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4' })
    await nextTick()
    expect(body.element.scrollTop).toBe(300)
    expect(vm.atBottom).toBe(true)

    // User scrolls up to inspect history: auto-follow pauses.
    body.element.scrollTop = 80
    await body.trigger('scroll')
    expect(vm.atBottom).toBe(false)
    expect(wrapper.emitted('atBottomChange')).toEqual([[false]])

    scrollHeight = 520
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4\nline 5' })
    await nextTick()
    expect(body.element.scrollTop).toBe(80)
    expect(vm.atBottom).toBe(false)

    // Scrolling back near the bottom resumes auto-follow.
    body.element.scrollTop = 350 // distance 520 - 350 - 160 = 10 <= 24
    await body.trigger('scroll')
    expect(vm.atBottom).toBe(true)
    expect(wrapper.emitted('atBottomChange')).toEqual([[false], [true]])

    scrollHeight = 600
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6' })
    await nextTick()
    expect(body.element.scrollTop).toBe(440)

    // Upward wheel also pauses following immediately, and scrollToBottom resumes it.
    await body.trigger('wheel', { deltaY: -40 })
    scrollHeight = 660
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7' })
    await nextTick()
    expect(body.element.scrollTop).toBe(440)

    vm.scrollToBottom()
    expect(body.element.scrollTop).toBe(500)
    expect(vm.atBottom).toBe(true)

    scrollHeight = 720
    await wrapper.setProps({
      code: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8',
    })
    await nextTick()
    expect(body.element.scrollTop).toBe(560)
  })

  it('respects explicit autoScroll overrides regardless of streaming', async () => {
    const disabled = mount(DouCodeBlock, {
      props: { code: 'a\nb', maxHeight: 120, streaming: true, autoScroll: false },
    })
    const bodyA = disabled.get('.dou-code-block__body').element
    Object.defineProperty(bodyA, 'clientHeight', { configurable: true, value: 120 })
    Object.defineProperty(bodyA, 'scrollHeight', { configurable: true, value: 320 })
    await disabled.setProps({ code: 'a\nb\nc' })
    await nextTick()
    expect(bodyA.scrollTop).toBe(0)

    const enabled = mount(DouCodeBlock, {
      props: { code: 'a\nb', maxHeight: 120, streaming: false, autoScroll: true },
    })
    const bodyB = enabled.get('.dou-code-block__body').element
    Object.defineProperty(bodyB, 'clientHeight', { configurable: true, value: 120 })
    Object.defineProperty(bodyB, 'scrollHeight', { configurable: true, value: 320 })
    await enabled.setProps({ code: 'a\nb\nc' })
    await nextTick()
    expect(bodyB.scrollTop).toBe(200)

    const plain = mount(DouCodeBlock, {
      props: { code: 'a\nb', maxHeight: 120 },
    })
    const bodyC = plain.get('.dou-code-block__body').element
    Object.defineProperty(bodyC, 'clientHeight', { configurable: true, value: 120 })
    Object.defineProperty(bodyC, 'scrollHeight', { configurable: true, value: 320 })
    await plain.setProps({ code: 'a\nb\nc' })
    await nextTick()
    expect(bodyC.scrollTop).toBe(0)
  })
})
