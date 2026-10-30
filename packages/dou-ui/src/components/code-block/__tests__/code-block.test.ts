import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouCodeBlock, DouConfigProvider } from '../../../index'
import type { CodeBlockHighlighter } from '../../../index'
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
})
