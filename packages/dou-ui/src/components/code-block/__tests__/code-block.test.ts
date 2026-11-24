import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { DouCodeBlock, DouConfigProvider } from '../../../index'
import type {
  CodeBlockExpose,
  CodeBlockHighlightContext,
  CodeBlockHighlighter,
} from '../../../index'
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

const legacySyncHighlight: CodeBlockHighlighter = (source, lang) =>
  `<span class="line" data-lang="${lang}"><b>${source}</b></span>`

const legacyAsyncHighlight: CodeBlockHighlighter = async (source, lang) =>
  `<span class="line" data-lang="${lang}"><i>${source}</i></span>`

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

  it('does not prematurely report atBottom during smooth scrollToBottom and handles interruption', async () => {
    const wrapper = mount(DouCodeBlock, {
      props: { code: 'line 1\nline 2\nline 3', maxHeight: 160, streaming: true },
    })
    const vm = wrapper.vm as unknown as CodeBlockExpose
    const body = wrapper.get('.dou-code-block__body')

    let scrollHeight = 520
    Object.defineProperty(body.element, 'clientHeight', { configurable: true, get: () => 160 })
    Object.defineProperty(body.element, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    })

    // Simulate browser async smooth scrollTo (does not jump scrollTop immediately).
    const scrollToSpy = vi.fn<(options?: ScrollToOptions) => void>()
    Object.defineProperty(body.element, 'scrollTo', {
      configurable: true,
      value: scrollToSpy,
    })

    // Start pinned at bottom, then user scrolls up.
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4' })
    await nextTick()
    expect(body.element.scrollTop).toBe(360)

    body.element.scrollTop = 80
    await body.trigger('scroll')
    expect(vm.atBottom).toBe(false)
    expect(wrapper.emitted('atBottomChange')).toEqual([[false]])

    // Calling scrollToBottom('smooth') while far from bottom must not flicker atBottom to true.
    vm.scrollToBottom('smooth')
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 520, behavior: 'smooth' })
    expect(vm.atBottom).toBe(false)
    expect(wrapper.emitted('atBottomChange')).toEqual([[false]])

    // Mid-flight smooth scroll frame stays atBottom=false with no extra emissions.
    body.element.scrollTop = 220
    await body.trigger('scroll')
    expect(vm.atBottom).toBe(false)
    expect(wrapper.emitted('atBottomChange')).toEqual([[false]])

    // Interrupting smooth scroll upward pauses following; new content does not snap to bottom.
    body.element.scrollTop = 180
    await body.trigger('scroll')
    scrollHeight = 580
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4\nline 5' })
    await nextTick()
    expect(body.element.scrollTop).toBe(180)
    expect(vm.atBottom).toBe(false)
    expect(wrapper.emitted('atBottomChange')).toEqual([[false]])

    // Starting smooth scroll again and reaching the bottom emits atBottomChange(true) once.
    vm.scrollToBottom('smooth')
    expect(vm.atBottom).toBe(false)
    body.element.scrollTop = 410 // distance 580 - 410 - 160 = 10 <= 24
    await body.trigger('scroll')
    expect(vm.atBottom).toBe(true)
    expect(wrapper.emitted('atBottomChange')).toEqual([[false], [true]])

    // Subsequent streaming output resumes auto-following to the bottom.
    scrollHeight = 640
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6' })
    await nextTick()
    expect(body.element.scrollTop).toBe(480)
  })

  it('pauses following on small upward scroll within threshold, but keeps following when clamped by shorter content', async () => {
    const wrapper = mount(DouCodeBlock, {
      props: { code: 'line 1\nline 2\nline 3', maxHeight: 160, streaming: true },
    })
    const vm = wrapper.vm as unknown as CodeBlockExpose
    const body = wrapper.get('.dou-code-block__body')

    let scrollHeight = 460
    Object.defineProperty(body.element, 'clientHeight', { configurable: true, get: () => 160 })
    Object.defineProperty(body.element, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    })

    // Pin to bottom: scrollTop = 300.
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4' })
    await nextTick()
    expect(body.element.scrollTop).toBe(300)

    // Small upward scroll of 12px (still within 24px threshold) must pause following.
    await body.trigger('wheel', { deltaY: -12 })
    body.element.scrollTop = 288
    await body.trigger('scroll')

    // Next streaming append must NOT pull scrollTop back to bottom.
    scrollHeight = 520
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4\nline 5' })
    await nextTick()
    expect(body.element.scrollTop).toBe(288)
    expect(vm.atBottom).toBe(false)

    // Scrolling downward back near the bottom resumes following.
    body.element.scrollTop = 350 // distance 520 - 350 - 160 = 10 <= 24
    await body.trigger('scroll')
    expect(vm.atBottom).toBe(true)

    scrollHeight = 560
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6' })
    await nextTick()
    expect(body.element.scrollTop).toBe(400)

    // Content shrinks so browser clamps scrollTop down while distance stays 0: must keep following.
    scrollHeight = 360
    body.element.scrollTop = 200
    await body.trigger('scroll')

    scrollHeight = 420
    await wrapper.setProps({ code: 'line 1\nline 2\nline 3\nline 4' })
    await nextTick()
    expect(body.element.scrollTop).toBe(260)
    expect(vm.atBottom).toBe(true)
  })

  it('passes an AbortSignal and aborts the previous highlight when code or lang changes', async () => {
    const runs: {
      code: string
      lang: string
      signal: AbortSignal
      abortCount: number
      resolve: (html: string) => void
      reject: (reason?: unknown) => void
    }[] = []
    const highlight: CodeBlockHighlighter = (source, lang, context?: CodeBlockHighlightContext) =>
      new Promise<string>((finish, reject) => {
        const signal = context!.signal
        const entry = { code: source, lang, signal, abortCount: 0, resolve: finish, reject }
        signal.addEventListener('abort', () => {
          entry.abortCount += 1
          reject(new DOMException('Aborted', 'AbortError'))
        })
        runs.push(entry)
      })

    const wrapper = mount(DouCodeBlock, {
      props: { code: 'const a = 1', lang: 'ts', highlight },
    })
    expect(runs).toHaveLength(1)
    expect(runs[0]!.signal).toBeInstanceOf(AbortSignal)
    expect(runs[0]!.signal.aborted).toBe(false)

    // Changing code aborts the in-flight request and starts a new one.
    await wrapper.setProps({ code: 'const b = 2' })
    expect(runs).toHaveLength(2)
    expect(runs[0]!.signal.aborted).toBe(true)
    expect(runs[0]!.abortCount).toBe(1)
    expect(runs[1]!.signal.aborted).toBe(false)

    // Resolving the latest run lands its HTML, and no unhandled rejection occurs from the aborted run.
    runs[1]!.resolve('<span class="line"><b>const b = 2</b></span>')
    await flushPromises()
    expect(wrapper.get('.dou-code-block__line b').text()).toBe('const b = 2')

    // Changing lang triggers a fresh highlight even when code is unchanged, and aborts the previous run.
    await wrapper.setProps({ lang: 'js' })
    expect(runs).toHaveLength(3)
    expect(runs[1]!.signal.aborted).toBe(true)
    expect(runs[2]!.lang).toBe('js')
    expect(runs[2]!.signal.aborted).toBe(false)

    // Changing lang again while the previous run is still pending aborts it cleanly.
    await wrapper.setProps({ lang: 'py' })
    expect(runs).toHaveLength(4)
    expect(runs[2]!.signal.aborted).toBe(true)
    expect(runs[2]!.abortCount).toBe(1)
    expect(runs[3]!.lang).toBe('py')
    runs[3]!.resolve('<span class="line"><em>py</em></span>')
    await flushPromises()
    expect(wrapper.get('.dou-code-block__line em').text()).toBe('py')
  })

  it('aborts the active highlight signal when unmounted or cleared', async () => {
    const signals: AbortSignal[] = []
    let abortEvents = 0
    const rejections: unknown[] = []
    const onUnhandled = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', onUnhandled)

    try {
      const highlight: CodeBlockHighlighter = (_source, _lang, context) =>
        new Promise<string>((_resolve, reject) => {
          const signal = context!.signal
          signals.push(signal)
          signal.addEventListener('abort', () => {
            abortEvents += 1
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })

      const wrapper = mount(DouCodeBlock, {
        props: { code: 'const x = 1', lang: 'ts', highlight },
      })
      expect(signals).toHaveLength(1)
      expect(signals[0]!.aborted).toBe(false)

      // Clearing code aborts the in-flight highlight.
      await wrapper.setProps({ code: '' })
      expect(signals[0]!.aborted).toBe(true)
      expect(abortEvents).toBe(1)

      // Start another in-flight highlight, then unmount.
      await wrapper.setProps({ code: 'const y = 2' })
      expect(signals).toHaveLength(2)
      expect(signals[1]!.aborted).toBe(false)

      wrapper.unmount()
      expect(signals[1]!.aborted).toBe(true)
      expect(abortEvents).toBe(2)

      await flushPromises()
      expect(rejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('ignores late resolutions from aborted highlighters and preserves streaming in-flight runs across tail updates', async () => {
    const pending: {
      source: string
      signal: AbortSignal
      resolve: (html: string) => void
    }[] = []
    const highlight: CodeBlockHighlighter = (source, _lang, context) =>
      new Promise<string>((finish) => {
        pending.push({ source, signal: context!.signal, resolve: finish })
      })

    const wrapper = mount(DouCodeBlock, {
      props: { code: 'line1\nta', lang: 'ts', highlight, streaming: true },
    })
    expect(pending).toHaveLength(1)
    expect(pending[0]!.source).toBe('line1')
    expect(pending[0]!.signal.aborted).toBe(false)

    // Appending characters to the unfinished tail line does not abort or restart the in-flight run.
    await wrapper.setProps({ code: 'line1\ntail' })
    expect(pending).toHaveLength(1)
    expect(pending[0]!.signal.aborted).toBe(false)
    expect(lineTexts(wrapper)).toEqual(['line1', 'tail'])

    // When the in-flight run settles, it keeps the latest tail text.
    pending[0]!.resolve('<span class="line"><b>line1</b></span>')
    await flushPromises()
    expect(wrapper.get('.dou-code-block__line b').text()).toBe('line1')
    expect(lineTexts(wrapper)).toEqual(['line1', 'tail'])

    // Completing the line starts a new run; completing another before it lands aborts the stale one.
    await wrapper.setProps({ code: 'line1\ntail\nnext' })
    expect(pending).toHaveLength(2)
    await wrapper.setProps({ code: 'line1\ntail\nnext\nmore' })
    expect(pending).toHaveLength(3)
    expect(pending[1]!.signal.aborted).toBe(true)
    expect(pending[2]!.signal.aborted).toBe(false)

    // Even if an ignored stale promise resolves later, it must not overwrite newer output.
    pending[2]!.resolve(
      '<span class="line"><b>line1</b></span>\n<span class="line"><b>tail</b></span>\n<span class="line"><b>next</b></span>',
    )
    await flushPromises()
    pending[1]!.resolve('<span class="line"><i>stale</i></span>')
    await flushPromises()
    expect(wrapper.find('i').exists()).toBe(false)
    expect(wrapper.findAll('.dou-code-block__line b').map((b) => b.text())).toEqual([
      'line1',
      'tail',
      'next',
    ])
  })

  it('remains backwards-compatible with two-argument highlight callbacks', async () => {
    const syncWrapper = mount(DouCodeBlock, {
      props: { code: 'x', lang: 'ts', highlight: legacySyncHighlight },
    })
    expect(syncWrapper.get('.dou-code-block__line b').text()).toBe('x')
    expect(syncWrapper.get('.dou-code-block__line .line').attributes('data-lang')).toBe('ts')

    const asyncWrapper = mount(DouCodeBlock, {
      props: { code: 'y', lang: 'js', highlight: legacyAsyncHighlight },
    })
    await flushPromises()
    expect(asyncWrapper.get('.dou-code-block__line i').text()).toBe('y')
    expect(asyncWrapper.get('.dou-code-block__line .line').attributes('data-lang')).toBe('js')
  })
})
