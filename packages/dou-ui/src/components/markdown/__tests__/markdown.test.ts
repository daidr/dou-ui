import { mount } from '@vue/test-utils'
import { createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DouAlert,
  DouChatMessage,
  DouCodeBlock,
  DouConfigProvider,
  DouMarkdown,
} from '../../../index'

let queue: FrameRequestCallback[] = []
function frames(count: number, step = 16) {
  for (let i = 0; i < count; i++) {
    vi.advanceTimersByTime(step)
    const run = queue
    queue = []
    for (const cb of run) cb(performance.now())
  }
}

// frame by frame, letting Vue draw after each few
async function drawFrames(count: number) {
  for (let i = 0; i < count; i++) {
    frames(8)
    await nextTick()
  }
}

beforeEach(() => {
  queue = []
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {
    queue = []
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const DOC = `## 行程

**注意：**周六有小雨[1]。

- 外滩
- 豫园

| 景点 | 门票 |
| --- | --: |
| 豫园 | 40 元 |

\`\`\`ts
const a = 1
\`\`\`
`

describe('DouMarkdown', () => {
  it('renders Markdown without raw HTML', () => {
    const wrapper = mount(DouMarkdown, { props: { content: DOC } })
    expect(wrapper.find('h2').text()).toBe('行程')
    expect(wrapper.find('strong').text()).toBe('注意：')
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.find('td[style*="right"]').text()).toBe('40 元')
    expect(wrapper.findComponent(DouCodeBlock).props()).toMatchObject({
      code: 'const a = 1',
      lang: 'ts',
    })
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })

  it('renders the same markup on the server', async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(DouMarkdown, { content: DOC }) }),
    )
    expect(html).toContain('<h2>行程</h2>')
    expect(html).toContain('<strong>注意：</strong>')
    expect(html).not.toContain('dou-markdown__fresh')
  })

  it('keeps scripts out', () => {
    const wrapper = mount(DouMarkdown, {
      props: {
        content:
          '<img src=x onerror=alert(1)> [a](javascript:alert(1)) [b](JAVA&#x09;SCRIPT:x) ![c](data:text/html,x) [d](https://a.com)',
      },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]!.attributes()).toMatchObject({
      href: 'https://a.com',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  })

  it('lets `sanitizeUrl` decide', () => {
    const wrapper = mount(DouMarkdown, {
      props: {
        content: '[a](https://a.com) [b](/b)',
        sanitizeUrl: (url: string) => (url.startsWith('/') ? url : undefined),
      },
    })
    expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toEqual(['/b'])
  })

  it('turns `[1]` into citations when given sources', () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: '最高 24 度[1]，见[2]。', sources: [{ title: '上海市气象局' }] },
    })
    expect(wrapper.findAll('.dou-chat-citation')).toHaveLength(1)
    expect(wrapper.text()).toContain('[2]')
  })

  it('hands code and images to slots', () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: '```mermaid\ngraph TD\n```\n\n![图](/a.png)' },
      slots: {
        code: ({ code, lang }: { code: string; lang: string }) =>
          h('pre', { class: 'own' }, `${lang}:${code}`),
        image: ({ src }: { src: string }) => h('span', { class: 'pic' }, src),
      },
    })
    expect(wrapper.find('.own').text()).toBe('mermaid:graph TD')
    expect(wrapper.find('.pic').text()).toBe('/a.png')
  })

  it('reveals a stream, fades new text in, and reports when done', async () => {
    const wrapper = mount(DouMarkdown, { props: { content: '', streaming: true, caret: true } })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.dou-markdown__caret').exists()).toBe(true)

    await wrapper.setProps({ content: '第一段文字\n\n第二段' })
    frames(4)
    await nextTick()
    const partial = wrapper.text()
    expect(partial.length).toBeGreaterThan(0)
    expect(partial.length).toBeLessThan(9)
    expect(wrapper.find('.dou-markdown__fresh').exists()).toBe(true)

    frames(60)
    await nextTick()
    expect(wrapper.findAll('p').map((p) => p.text())).toEqual(['第一段文字', '第二段'])
    // the caret follows the last paragraph
    expect(wrapper.find('p:last-of-type .dou-markdown__caret').exists()).toBe(true)

    // once the fades are over, the spans merge back into text
    vi.advanceTimersByTime(400)
    await nextTick()
    expect(wrapper.find('.dou-markdown__fresh').exists()).toBe(false)

    expect(wrapper.emitted('done')).toBeUndefined()
    await wrapper.setProps({ streaming: false })
    frames(1)
    await nextTick()
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(wrapper.find('.dou-markdown__caret').exists()).toBe(false)
  })

  it('does not redraw blocks that are finished', async () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: '# 标题\n\n第一段\n\n第二', streaming: true, smooth: false },
    })
    const heading = wrapper.find('h1').element
    const first = wrapper.findAll('p')[0]!.element
    const firstText = first.firstChild
    await wrapper.setProps({ content: '# 标题\n\n第一段\n\n第二段继续写' })
    frames(1)
    await nextTick()
    expect(wrapper.find('h1').element).toBe(heading)
    expect(wrapper.findAll('p')[0]!.element).toBe(first)
    expect(first.firstChild).toBe(firstText)
    expect(wrapper.findAll('p')[1]!.text()).toBe('第二段继续写')
  })

  it('shows content present at mount at once, without fading', () => {
    const wrapper = mount(DouMarkdown, { props: { content: '已有内容', streaming: true } })
    expect(wrapper.text()).toBe('已有内容')
    expect(wrapper.find('.dou-markdown__fresh').exists()).toBe(false)
  })

  it('shows a stream as it arrives without `smooth`', async () => {
    const wrapper = mount(DouMarkdown, { props: { content: '', streaming: true, smooth: false } })
    await wrapper.setProps({ content: '一次全部显示的内容' })
    frames(1)
    await nextTick()
    expect(wrapper.text()).toBe('一次全部显示的内容')
    expect(wrapper.find('.dou-markdown__fresh').exists()).toBe(false)
  })

  it('shows everything at once on `flush`', async () => {
    const wrapper = mount(DouMarkdown, { props: { content: '', streaming: true } })
    await wrapper.setProps({ content: '很长的一段回答，还没有显示完' })
    ;(wrapper.vm as unknown as { flush: () => void }).flush()
    await nextTick()
    expect(wrapper.text()).toBe('很长的一段回答，还没有显示完')
  })

  it('marks a code block that is still open as streaming', async () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: '```ts\nconst a', streaming: true, smooth: false },
    })
    expect(wrapper.findComponent(DouCodeBlock).props('streaming')).toBe(true)
    await wrapper.setProps({ content: '```ts\nconst a = 1\n```\n' })
    frames(1)
    await nextTick()
    expect(wrapper.findComponent(DouCodeBlock).props('streaming')).toBe(false)
  })
})

describe('DouMarkdown citations and links', () => {
  const sources = [
    { title: '上海市气象局', url: 'https://weather.example.com' },
    { title: '坏来源', url: 'javascript:alert(1)' },
  ]

  it('checks source addresses with `sanitizeUrl`', () => {
    const wrapper = mount(DouMarkdown, { props: { content: '晴[1]，雨[2]', sources } })
    const citations = wrapper.findAllComponents({ name: 'DouChatCitation' })
    expect(citations).toHaveLength(2)
    expect(citations[0]!.props('source')).toEqual(sources[0])
    expect(citations[1]!.props('source')).toMatchObject({ title: '坏来源', url: undefined })
    expect(wrapper.html()).not.toContain('javascript:')
  })

  it('keeps citations out of links, and reads `[1, 2]` and `[^1]`', () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: '[见 [1]](https://a.com) 晴[1, 2]，[^1]，a[1].b', sources },
    })
    expect(wrapper.find('a[href="https://a.com"] a').exists()).toBe(false)
    expect(wrapper.find('a[href="https://a.com"]').text()).toBe('见 [1]')
    expect(wrapper.findAllComponents({ name: 'DouChatCitation' })).toHaveLength(3)
    expect(wrapper.text()).toContain('a[1].b')
  })

  it('hands citations to the `citation` slot', () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: '晴[1]', sources },
      slots: {
        citation: ({ index, source }: { index: number; source: { title: string } }) =>
          h('sup', { class: 'own' }, `${index}:${source.title}`),
      },
    })
    expect(wrapper.find('.own').text()).toBe('1:上海市气象局')
  })

  it('opens only full addresses at `linkTarget`', () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: '[站内](/docs) [锚点](#a) [外部](https://a.com)' },
    })
    const [inside, anchor, outside] = wrapper.findAll('a')
    expect(inside!.attributes('target')).toBeUndefined()
    expect(anchor!.attributes('target')).toBeUndefined()
    expect(outside!.attributes('target')).toBe('_blank')
  })

  it('hands links to the `link` slot', () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: '[文档](/docs) 和 [坏](javascript:x)' },
      slots: {
        link: ({ href, children }: { href?: string; children: unknown }) =>
          h('button', { 'data-to': href ?? 'none' }, [children as never]),
      },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.attributes('data-to'))).toEqual(['/docs', 'none'])
    expect(buttons[0]!.text()).toBe('文档')
  })
})

describe('DouMarkdown custom rendering', () => {
  it('draws known containers as an Alert and others as a plain box', () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: ':::warning 注意\n周六**有雨**\n:::\n\n:::steps\n第一步\n:::' },
    })
    const alert = wrapper.findComponent(DouAlert)
    expect(alert.props()).toMatchObject({ tone: 'warning', title: '注意' })
    expect(alert.attributes('role')).toBe('note')
    expect(alert.find('strong').text()).toBe('有雨')
    expect(wrapper.find('.dou-markdown__container[data-name="steps"]').text()).toBe('第一步')
  })

  it('takes a container by name before the general slot', () => {
    const wrapper = mount(DouMarkdown, {
      props: { content: ':::tip 贴士\n带伞\n:::\n\n:::other\n别的\n:::', streaming: true },
      slots: {
        'container-tip': ({ title, children }: { title: string; children: unknown }) =>
          h('aside', { class: 'tip' }, [title, children as never]),
        container: ({ name, streaming }: { name: string; streaming: boolean }) =>
          h('div', { class: 'any' }, `${name}:${streaming}`),
      },
    })
    expect(wrapper.find('.tip').text()).toBe('贴士带伞')
    expect(wrapper.find('.any').text()).toBe('other:false')
  })

  it('replaces blocks and inline nodes by type, keeping their content', () => {
    const wrapper = mount(DouMarkdown, {
      props: {
        content: '## 行程\n\n**周六** `出发`\n\n```mermaid\ngraph TD\n```\n\n```ts\nlet a\n```',
      },
      slots: {
        heading: ({ level, children }: { level: number; children: unknown }) =>
          h('div', { class: `h${level}` }, [children as never]),
        strong: ({ children }: { children: unknown }) => h('b', [children as never]),
        'inline-code': ({ code }: { code: string }) => h('kbd', code),
        'code-mermaid': ({ code }: { code: string }) => h('figure', code),
      },
    })
    expect(wrapper.find('.h2').text()).toBe('行程')
    expect(wrapper.find('b').text()).toBe('周六')
    expect(wrapper.find('kbd').text()).toBe('出发')
    expect(wrapper.find('figure').text()).toBe('graph TD')
    expect(wrapper.findComponent(DouCodeBlock).props('code')).toBe('let a')
  })

  it('merges every fading span back into text once the fades end', async () => {
    const wrapper = mount(DouMarkdown, { props: { content: '', streaming: true } })
    await wrapper.setProps({ content: '第一段\n\n第二段\n\n第三段\n\n第四段' })
    // drawn frame by frame, so finished blocks are drawn while they fade
    await drawFrames(3)
    expect(wrapper.findAll('.dou-markdown__fresh').length).toBeGreaterThan(0)
    await drawFrames(7)
    vi.advanceTimersByTime(400)
    await nextTick()
    await nextTick()
    expect(wrapper.findAll('p')).toHaveLength(4)
    expect(wrapper.find('.dou-markdown__fresh').exists()).toBe(false)
  })
})

describe('DouCodeBlock streaming', () => {
  it('highlights whole lines only', async () => {
    const highlight = vi.fn<(code: string) => string>((code) =>
      code
        .split('\n')
        .map((line) => `<span class="line"><b>${line}</b></span>`)
        .join('\n'),
    )
    const wrapper = mount(DouCodeBlock, { props: { code: 'a\nb', highlight, streaming: true } })
    expect(highlight).toHaveBeenLastCalledWith('a', 'text')
    expect(wrapper.findAll('.dou-code-block__line b').map((b) => b.text())).toEqual(['a'])
    expect(wrapper.findAll('.dou-code-block__line').map((l) => l.text())).toEqual(['a', 'b'])
    const calls = highlight.mock.calls.length
    await wrapper.setProps({ code: 'a\nbc' })
    expect(highlight.mock.calls.length).toBe(calls)
    await wrapper.setProps({ code: 'a\nbc\nd' })
    expect(highlight).toHaveBeenLastCalledWith('a\nbc', 'text')
    await wrapper.setProps({ streaming: false })
    expect(highlight).toHaveBeenLastCalledWith('a\nbc\nd', 'text')
    expect(wrapper.findAll('.dou-code-block__line b')).toHaveLength(3)
  })

  it('keeps highlighted lines while an async highlighter works', async () => {
    const pending: ((html: string) => void)[] = []
    const highlight = (code: string) =>
      new Promise<string>((r) => {
        pending.push(r)
        void code
      })
    const wrapper = mount(DouCodeBlock, { props: { code: 'a\nb\n', highlight, streaming: true } })
    pending[pending.length - 1]!(
      '<span class="line"><b>a</b></span>\n<span class="line"><b>b</b></span>',
    )
    await nextTick()
    await nextTick()
    expect(wrapper.findAll('.dou-code-block__line b')).toHaveLength(2)
    await wrapper.setProps({ code: 'a\nb\nc\n' })
    // the old lines keep their colors until the new answer lands
    expect(wrapper.findAll('.dou-code-block__line b')).toHaveLength(2)
    expect(wrapper.findAll('.dou-code-block__line')).toHaveLength(3)
  })
})

describe('DouChatMessage markdown', () => {
  it('renders text parts as Markdown with the message sources as citations', () => {
    const wrapper = mount(DouChatMessage, {
      props: {
        markdown: true,
        parts: [
          { type: 'text', text: '**晴**，最高 24 度[1]' },
          {
            type: 'sources',
            items: [{ title: '上海市气象局', url: 'https://weather.example.com' }],
          },
        ],
      },
    })
    expect(wrapper.find('.dou-markdown strong').text()).toBe('晴')
    expect(wrapper.find('.dou-markdown .dou-chat-citation').exists()).toBe(true)
  })

  it('keeps plain text by default', () => {
    const wrapper = mount(DouChatMessage, { props: { content: '**不加粗**' } })
    expect(wrapper.find('.dou-markdown').exists()).toBe(false)
    expect(wrapper.text()).toContain('**不加粗**')
  })
})

describe('DouChatMessage markdown options', () => {
  it('takes Markdown options and `markdown-` slots', () => {
    const wrapper = mount(DouChatMessage, {
      props: {
        markdown: { sanitizeUrl: (url: string) => (url.startsWith('/') ? url : undefined) },
        parts: [{ type: 'text', text: '[a](https://a.com) [b](/b)\n\n```mermaid\ngraph\n```' }],
      },
      slots: { 'markdown-code-mermaid': ({ code }: { code: string }) => h('figure', code) },
    })
    expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toEqual(['/b'])
    expect(wrapper.find('figure').text()).toBe('graph')
  })

  it('renders reasoning as Markdown too', () => {
    const wrapper = mount(DouChatMessage, {
      props: { markdown: true, parts: [{ type: 'reasoning', text: '**分析**一下' }] },
    })
    expect(wrapper.find('.dou-markdown strong').text()).toBe('分析')
  })

  it('reads ConfigProvider defaults for the Markdown inside', () => {
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(DouConfigProvider, { defaults: { DouMarkdown: { linkTarget: '_self' } } }, () =>
            h(DouChatMessage, { markdown: true, content: '[a](https://a.com)' }),
          ),
      }),
    )
    expect(wrapper.find('a').attributes('target')).toBeUndefined()
  })
})
