import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouCodeDiff, DouCodeEditor, defineCodeExtension, diffText } from '../index'

/** Applies the hunks of `a` → `b` to `a`'s lines; must give back `b`. */
function apply(a: string, b: string, ignoreWhitespace = false) {
  const al = a.split('\n')
  const bl = b.split('\n')
  const out: string[] = []
  let i = 0
  for (const hunk of diffText(a, b, { ignoreWhitespace })) {
    while (i < hunk.originalStart - 1) out.push(al[i++]!)
    i += hunk.originalCount
    out.push(...bl.slice(hunk.modifiedStart - 1, hunk.modifiedStart - 1 + hunk.modifiedCount))
  }
  while (i < al.length) out.push(al[i++]!)
  return out.join('\n')
}

describe('diffText', () => {
  it('finds the changed blocks, numbered from 1', () => {
    expect(diffText('a\nb\nc', 'a\nb\nc')).toEqual([])
    const [insert] = diffText('a\nc', 'a\nb\nc')
    expect(insert).toMatchObject({
      originalStart: 2,
      originalCount: 0,
      modifiedStart: 2,
      modifiedCount: 1,
    })
    const [remove] = diffText('a\nb\nc', 'a\nc')
    expect(remove).toMatchObject({ originalStart: 2, originalCount: 1, modifiedCount: 0 })
  })

  it('always describes a way from one text to the other', () => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let t = 0; t < 500; t++) {
      const text = () =>
        Array.from(
          { length: Math.floor(random() * 14) },
          () => 'abcde'[Math.floor(random() * 5)],
        ).join('\n')
      const a = text()
      const b = text()
      expect(apply(a, b)).toBe(b)
    }
  })

  it('marks the words that changed, at offsets in each text', () => {
    const a = 'const fee = 4\nreturn fee'
    const b = 'const fee = REMOTE_FEE\nreturn round(fee, 2)'
    const [hunk] = diffText(a, b)
    const words = hunk!.parts.map((part) => [
      a.slice(part.original.from, part.original.to),
      b.slice(part.modified.from, part.modified.to),
    ])
    expect(words).toEqual([
      ['4', 'REMOTE_FEE'],
      ['', 'round('],
      ['', ', 2)'],
    ])
    // Chinese has no spaces: each character counts.
    const [cjk] = diffText('寄往上海', '寄往杭州')
    expect(cjk!.parts.map((p) => '寄往杭州'.slice(p.modified.from, p.modified.to))).toEqual([
      '杭州',
    ])
    // Nearly everything changed: only the lines are marked.
    expect(diffText('abc def', 'xyz uvw')[0]!.parts).toEqual([])
    expect(diffText('a b', 'a c', { words: false })[0]!.parts).toEqual([])
  })

  it('can treat lines that differ only in spaces as the same', () => {
    expect(
      diffText('if (a) {\n  b()\n}', 'if (a)  {\n    b()\n}', { ignoreWhitespace: true }),
    ).toEqual([])
    expect(apply('x\n a', 'x\na\ny', true)).toBe('x\n a\ny')
  })

  it('gives up on huge rewrites quickly, as one block', () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join('\n')
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`).join('\n')
    const start = performance.now()
    expect(diffText(a, b)).toHaveLength(1)
    expect(performance.now() - start).toBeLessThan(1000)
  })
})

const original = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n')
const changed = original
  .replace('line 3', 'line three')
  .replace('line 20\n', '')
  .replace('line 25', 'line 25\nline 25b\nline 25c')

function setup(props: Record<string, unknown> = {}) {
  const code = ref(changed)
  const diff = ref<InstanceType<typeof DouCodeDiff>>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouCodeDiff, {
          ref: diff,
          original,
          modelValue: code.value,
          'onUpdate:modelValue': (value: string) => (code.value = value),
          mode: 'split',
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  return { wrapper, code, diff }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouCodeDiff', () => {
  it('tints changed lines on each side and fills the shorter side', async () => {
    const { wrapper } = setup({
      original: 'a\nb\nc\nd',
      modelValue: 'a\nB\nb2\nb3\nd',
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    expect(a!.findAll('.dou-code-diff__line.is-removed').map((l) => l.text())).toEqual(['b', 'c'])
    expect(b!.findAll('.dou-code-diff__line.is-added').map((l) => l.text())).toEqual([
      'B',
      'b2',
      'b3',
    ])
    expect(a!.findAll('.dou-code-diff__sign').map((s) => s.text())).toEqual(['−', '−'])
    // One line more on the right: a filler of one line on the left.
    const fillers = a!.findAll('.dou-code-diff__filler')
    expect(fillers.map((f) => f.attributes('style'))).toEqual([
      expect.stringContaining('calc(1 * var(--dou-code-editor-line-height))'),
    ])
    expect(b!.findAll('.dou-code-diff__filler')).toHaveLength(0)
    expect(wrapper.find('.dou-code-diff__stats').text()).toContain('+3')
    expect(wrapper.find('.dou-code-diff__stats').text()).toContain('−2')
  })

  it('marks the words that changed', async () => {
    const { wrapper } = setup()
    await nextTick()
    await nextTick()
    const [, b] = wrapper.findAll('.dou-code-diff__side')
    expect(b!.find('.dou-code-diff__word.is-added').text()).toBe('three')
  })

  it('hides long unchanged runs behind a bar that shows them', async () => {
    const { wrapper } = setup()
    await nextTick()
    await nextTick()
    // Lines 7–16 are 3 away from both changes: hidden on both sides, the same bar on each.
    const bars = wrapper.findAll('.dou-code-diff__bar')
    expect(bars.map((bar) => bar.text())).toEqual(['10 行未改动', '10 行未改动'])
    const left = wrapper.findAll('.dou-code-diff__side')[0]!
    const shown = () => left.findAll('.dou-code-editor__line').map((l) => l.text())
    expect(shown().slice(5, 8)).toEqual(['line 6', 'line 17', 'line 18'])
    await bars[0]!.trigger('click')
    await nextTick()
    expect(wrapper.findAll('.dou-code-diff__bar')).toHaveLength(0)
    expect(shown().slice(5, 8)).toEqual(['line 6', 'line 7', 'line 8'])

    const { wrapper: open } = setup({ collapseUnchanged: false })
    await nextTick()
    expect(open.findAll('.dou-code-diff__bar')).toHaveLength(0)
  })

  it('shows the changes in one column inline, with both line numbers', async () => {
    const { wrapper } = setup({ mode: 'inline', collapseUnchanged: false })
    await nextTick()
    await nextTick()
    const lines = wrapper.findAll('.dou-code-editor__line')
    expect(lines.slice(1, 4).map((l) => l.text())).toEqual(['line 2', 'line 3', 'line three'])
    expect(lines[2]!.classes()).toContain('is-removed')
    expect(lines[3]!.classes()).toContain('is-added')
    const numbers = wrapper.findAll('.dou-code-editor__number')[2]!
    expect(numbers.findAll('.dou-code-diff__number').map((n) => n.text())).toEqual(['3', ''])
    expect(numbers.find('.dou-code-diff__sign').text()).toBe('−')
  })

  it('goes from change to change with F7, reading out where it is', async () => {
    const { wrapper, diff } = setup()
    await nextTick()
    await nextTick()
    const textarea = wrapper.findAll('textarea')[1]!.element
    textarea.focus()
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F7', bubbles: true, cancelable: true }),
    )
    await nextTick()
    expect(wrapper.find('.dou-code-diff__live').text()).toBe(
      '第 1 处改动，共 3 处，第 3 行：删除 1 行，新增 1 行',
    )
    expect(diff.value!.modified!.selection.ranges[0]!.head).toBe(14)
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F7', shiftKey: true, bubbles: true, cancelable: true }),
    )
    await nextTick()
    expect(wrapper.find('.dou-code-diff__live').text()).toContain('第 3 处改动')
    expect(diff.value!.hunks).toHaveLength(3)
  })

  it('edits the modified side when not read-only, and follows the edit', async () => {
    const { wrapper, code, diff } = setup({ readonly: false })
    await nextTick()
    diff.value!.modified!.transact((tr) => tr.insert(0, 'new\n'))
    await nextTick()
    expect(code.value.startsWith('new\n')).toBe(true)
    expect(diff.value!.hunks[0]).toMatchObject({ originalStart: 1, originalCount: 0 })
    expect(wrapper.find('.dou-code-diff__stats').text()).toContain('+4')
  })

  it('switches view with the toolbar and says so with update:mode', async () => {
    const modes: string[] = []
    const { wrapper } = setup({ 'onUpdate:mode': (mode: string) => modes.push(mode) })
    await nextTick()
    const buttons = wrapper.findAll('.dou-code-diff__toolbar button')
    await buttons[buttons.length - 1]!.trigger('click')
    expect(modes).toEqual(['inline'])
    expect(wrapper.find('.dou-code-diff--inline').exists()).toBe(true)
  })
})

describe('the hide extension field', () => {
  it('leaves lines out, and up and down step over them', async () => {
    const wrapper = mount(DouCodeEditor, {
      props: {
        modelValue: 'a\nb\nc\nd',
        extensions: [defineCodeExtension({ name: 'hide', hide: () => [{ from: 2, to: 3 }] })],
      },
      attachTo: document.body,
    })
    await nextTick()
    expect(wrapper.findAll('.dou-code-editor__line').map((l) => l.text())).toEqual(['a', 'd'])
    const textarea = wrapper.find('textarea').element
    textarea.focus()
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    )
    await nextTick()
    expect(
      (wrapper.vm as unknown as { selection: { ranges: { head: number }[] } }).selection.ranges[0]!
        .head,
    ).toBe(6)
  })
})
