import { type DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    // The counts are drawn; the sentence is for screen readers.
    expect(wrapper.find('.dou-code-diff__hidden-text').text()).toBe('新增 3 行，删除 2 行')
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
    // One stop for the keyboard and screen readers: the original's bar mirrors the other.
    expect(bars[0]!.attributes('aria-hidden')).toBe('true')
    expect(bars[0]!.attributes('tabindex')).toBe('-1')
    expect(bars[1]!.attributes('aria-hidden')).toBeUndefined()
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
    const { wrapper, code, diff } = setup({ editable: true })
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

/** The tops of the widgets one side draws. */
const tops = (side: DOMWrapper<Element>) =>
  side
    .findAll('.dou-code-editor__widget')
    .map((w) => /translate\([^,]+, ([-\d.]+)px\)/.exec(w.attributes('style') ?? '')?.[1])

describe('DouCodeDiff gutters and widgets', () => {
  it('draws markers on their side, and says which side was pressed', async () => {
    const pressed: unknown[] = []
    const { wrapper } = setup({
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      gutters: [
        {
          name: 'notes',
          markers: [
            { side: 'original', line: 2, text: 'o', title: '原文的标记' },
            { side: 'modified', line: 3, text: 'm', title: '修改后的标记' },
          ],
          onPress: (line: number, _event: Event, side: string) => pressed.push([line, side]),
        },
      ],
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    const cell = (side: typeof a, line: number) =>
      side!.find(`[data-gutter-cell][data-line="${line}"]`)
    expect(cell(a, 2).text()).toBe('o')
    expect(cell(a, 3).text()).toBe('')
    expect(cell(b, 3).text()).toBe('m')
    await cell(a, 1).trigger('pointerdown', { button: 0 })
    await cell(b, 2).trigger('pointerdown', { button: 0 })
    // a marker is a button: Enter presses it, with the side it is on
    await cell(b, 3).trigger('keydown', { key: 'Enter' })
    expect(pressed).toEqual([
      [1, 'original'],
      [2, 'modified'],
      [3, 'modified'],
    ])
  })

  it('leaves a blank across from a widget, also inside a filler', async () => {
    const { wrapper } = setup({
      original: 'a\nb\nc\nd\ne',
      modelValue: 'a\nB\ne',
      collapseUnchanged: false,
      widgets: [
        { id: 'one', side: 'original', line: 1, height: 40, render: () => h('p', '戴兜') },
        // Original line 3 has no partner: its blank goes in the filler, after one row.
        { id: 'two', side: 'original', line: 3, height: 30, render: () => h('p', '上海') },
        {
          id: 'three',
          side: 'modified',
          line: 3,
          position: 'above',
          height: 24,
          render: () => h('p', '阿青'),
        },
      ],
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    expect(a!.findAll('.dou-code-diff__widget').map((w) => w.text())).toEqual(['戴兜', '上海'])
    expect(b!.findAll('.dou-code-diff__widget').map((w) => w.text())).toEqual(['阿青'])
    // The modified side's filler: one row, the blank for 上海, then the last row.
    const filler = b!.find('.dou-code-editor__widget:has(.dou-code-diff__filler)')
    expect(
      [...filler.element.firstElementChild!.children].map((d) =>
        d.classList.contains('dou-code-diff__spacer') ? d.getAttribute('style') : 'rows',
      ),
    ).toEqual(['rows', 'height: 30px;', 'rows'])
    // Both sides line up: 上海 at 108 on the left; on the right, the filler at 88 and its blank one row (20) in.
    expect(tops(a!)).toEqual(['28', '108', '158'])
    expect(tops(b!)).toEqual(['28', '88', '158'])
  })

  it('maps markers and widgets onto the rows inline', async () => {
    const pressed: unknown[] = []
    const { wrapper } = setup({
      mode: 'inline',
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      gutters: [
        {
          name: 'notes',
          markers: [
            { side: 'original', line: 2, text: 'o' },
            { side: 'modified', line: 2, text: 'm' },
            { side: 'original', line: 3, text: 'x' },
            { side: 'modified', line: 3, text: 'y' },
          ],
          onPress: (line: number, _event: Event, side: string) => pressed.push([line, side]),
        },
      ],
      widgets: [
        { id: 'w', side: 'modified', line: 2, render: () => h('p', '戴兜') },
        { id: 'v', side: 'original', line: 2, span: 'both', render: () => h('p', '上海') },
      ],
    })
    await nextTick()
    await nextTick()
    const cell = (row: number) => wrapper.find(`[data-gutter-cell][data-line="${row}"]`)
    // Rows: a, b (removed), B (added), c (both: the modified side's marker).
    expect([1, 2, 3, 4].map((row) => cell(row).text())).toEqual(['', 'o', 'm', 'y'])
    await cell(1).trigger('pointerdown', { button: 0 })
    await cell(2).trigger('pointerdown', { button: 0 })
    await cell(4).trigger('pointerdown', { button: 0 })
    expect(pressed).toEqual([
      [1, 'modified'],
      [2, 'original'],
      [3, 'modified'],
    ])
    expect(wrapper.findAll('.dou-code-diff__widget').map((w) => w.text())).toEqual(['上海', '戴兜'])
    expect(wrapper.find('.dou-code-diff__spans').exists()).toBe(false)
  })

  it('draws a widget across both sides over the blanks on each', async () => {
    const { wrapper } = setup({
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      widgets: [
        {
          id: 'both',
          side: 'modified',
          line: 2,
          span: 'both',
          label: '戴兜的评论',
          render: () => h('p', '戴兜'),
        },
      ],
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    expect(a!.find('[data-diff-span="both"]').exists()).toBe(true)
    expect(b!.find('[data-diff-span="both"]').exists()).toBe(true)
    expect(wrapper.findAll('.dou-code-diff__widget')).toHaveLength(0)
    const span = wrapper.find('.dou-code-diff__spans .dou-code-diff__span')
    expect(span.text()).toBe('戴兜')
    expect(span.attributes('aria-label')).toBe('戴兜的评论')
    expect(span.classes()).toContain('is-placed')
  })
})

/** Resize observers that report when told to, as a browser does after layout. */
function observers() {
  const all: { callback: ResizeObserverCallback; els: Set<Element> }[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      own: { callback: ResizeObserverCallback; els: Set<Element> }
      constructor(callback: ResizeObserverCallback) {
        this.own = { callback, els: new Set() }
        all.push(this.own)
      }
      observe(el: Element) {
        this.own.els.add(el)
      }
      unobserve(el: Element) {
        this.own.els.delete(el)
      }
      disconnect() {
        this.own.els.clear()
      }
    },
  )
  return () => {
    for (const { callback, els } of all)
      callback(
        [...els].map(
          (target) => ({ target, contentRect: { width: 800, height: 400 } }) as ResizeObserverEntry,
        ),
        {} as ResizeObserver,
      )
  }
}

// Lays out the editors' widgets only: a widget's content at its data-h, a blank at its own height.
function layOut() {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.isConnected || !this.classList.contains('dou-code-editor__widget')) return 0
      const own = this.querySelector<HTMLElement>('[data-h]')
      if (own) return Number(own.dataset.h)
      const blank = this.querySelector<HTMLElement>('.dou-code-diff__spacer')
      return blank ? Number.parseInt(blank.style.height, 10) : 0
    },
  })
}

describe('DouCodeDiff widget heights', () => {
  const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeight)
    vi.unstubAllGlobals()
  })
  it('leaves a blank as high as the editor measured the widget, line for line', async () => {
    layOut()
    const report = observers()
    const { wrapper } = setup({
      original: 'a\nb\nc\nd\ne',
      modelValue: 'a\nb\nC\nd\ne',
      collapseUnchanged: false,
      widgets: [
        // no height given: the editor finds 40 when it draws them
        { id: 'one', side: 'original', line: 1, render: () => h('div', { 'data-h': 40 }) },
        { id: 'two', side: 'modified', line: 4, render: () => h('div', { 'data-h': 64 }) },
      ],
    })
    await nextTick()
    await nextTick()
    report()
    for (let i = 0; i < 4; i++) await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    const blanks = (side: typeof a) =>
      side!.findAll('.dou-code-diff__spacer').map((blank) => blank.attributes('style'))
    expect(blanks(a)).toEqual(['height: 64px;'])
    expect(blanks(b)).toEqual(['height: 40px;'])
    // Each widget and the blank across from it start at the same y, so the lines after them line up.
    expect(tops(a!)).toEqual(tops(b!))
    const lines = (side: typeof a) =>
      side!.findAll('.dou-code-editor__line').map((line) => line.attributes('style'))
    expect(lines(a)).toEqual(lines(b))
  })
})

describe('DouCodeDiff hoverMarker', () => {
  it('offers a marker on every other line of its side, shown on hover', async () => {
    const pressed: unknown[] = []
    const { wrapper } = setup({
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      collapseUnchanged: false,
      gutters: [
        {
          name: 'comments',
          markers: [{ side: 'modified', line: 1, text: 'm', title: '戴兜的评论' }],
          hoverMarker: {
            text: '+',
            title: (line: number, side: string) => `${side} ${line}`,
            side: 'modified',
          },
          onPress: (line: number, _event: Event, side: string) => pressed.push([line, side]),
        },
      ],
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    const cell = (side: typeof a, line: number) =>
      side!.find(`[data-gutter-cell][data-line="${line}"]`)
    // its own marker wins; the others show on hover; the original side has none
    expect([1, 2, 3].map((line) => cell(b, line).text())).toEqual(['m', '+', '+'])
    expect(cell(b, 1).classes()).not.toContain('is-on-hover')
    expect(cell(b, 2).classes()).toContain('is-on-hover')
    expect(cell(b, 2).attributes('aria-label')).toBe('modified 2')
    expect(a!.findAll('.dou-code-editor__cell').map((c) => c.text())).not.toContain('+')
    expect(a!.find('[data-gutter-cell]').exists()).toBe(false)
    await cell(b, 2).trigger('keydown', { key: 'Enter' })
    expect(pressed).toEqual([[2, 'modified']])
  })

  it('counts a shared row inline as the side of the marker drawn there, over the hover one', async () => {
    const pressed: unknown[] = []
    const { wrapper } = setup({
      mode: 'inline',
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      gutters: [
        {
          name: 'comments',
          markers: [{ side: 'original', line: 1, text: 'o', title: '阿青的评论' }],
          hoverMarker: {
            text: '+',
            title: (line: number, side: string) => `${side} 第 ${line} 行`,
          },
          onPress: (line: number, _event: Event, side: string) => pressed.push([line, side]),
        },
      ],
    })
    await nextTick()
    await nextTick()
    const cell = (row: number) => wrapper.find(`[data-gutter-cell][data-line="${row}"]`)
    expect(cell(1).text()).toBe('o')
    // named for the line and side a press there goes to, not the inline row
    expect([2, 3, 4].map((row) => cell(row).attributes('aria-label'))).toEqual([
      'original 第 2 行',
      'modified 第 2 行',
      'modified 第 3 行',
    ])
    await cell(1).trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    await cell(4).trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    expect(pressed).toEqual([
      [1, 'original'],
      [3, 'modified'],
    ])
  })

  it('leaves the other side to its own markers when it is on one side only', async () => {
    const pressed: unknown[] = []
    const onPress = (line: number, _event: Event, side: string) => pressed.push([line, side])
    const { wrapper } = setup({
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      collapseUnchanged: false,
      gutters: [
        {
          name: 'comments',
          markers: [{ side: 'original', line: 3, text: 'o', title: '阿青的评论' }],
          hoverMarker: { text: '+', title: '加评论', side: 'modified' },
          onPress,
        },
      ],
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    const press = (side: typeof a, line: number) =>
      side!
        .find(`[data-gutter-cell][data-line="${line}"]`)
        .trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    // the original side's empty cells aren't pressable: no pointer over them
    expect(a!.find('[data-gutter-cell][data-line="2"]').exists()).toBe(false)
    expect(a!.find('[data-gutter-cell][data-line="3"]').exists()).toBe(true)
    await press(a, 3)
    await press(b, 2)
    expect(pressed).toEqual([
      [3, 'original'],
      [2, 'modified'],
    ])
    wrapper.unmount()
    pressed.length = 0
    // inline: an added row has no place for an original-only marker
    const inline = setup({
      mode: 'inline',
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      gutters: [
        {
          name: 'comments',
          hoverMarker: { text: '+', title: '加评论', side: 'original' },
          onPress,
        },
      ],
    }).wrapper
    await nextTick()
    await nextTick()
    const cell = (row: number) => inline.find(`[data-gutter-cell][data-line="${row}"]`)
    // Rows: a, b (removed), B (added), c
    const any = (row: number) => inline.find(`.dou-code-editor__cell[data-line="${row}"]`)
    expect([1, 2, 3, 4].map((row) => any(row).text())).toEqual(['+', '+', '', '+'])
    expect(cell(3).exists()).toBe(false)
    await cell(2).trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    expect(pressed).toEqual([[2, 'original']])
  })

  it('puts it on each row inline, counting a row as the side it marks', async () => {
    const pressed: unknown[] = []
    const { wrapper } = setup({
      mode: 'inline',
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      gutters: [
        {
          name: 'comments',
          hoverMarker: { text: '+', title: '加评论' },
          onPress: (line: number, _event: Event, side: string) => pressed.push([line, side]),
        },
      ],
    })
    await nextTick()
    await nextTick()
    const cell = (row: number) => wrapper.find(`[data-gutter-cell][data-line="${row}"]`)
    // Rows: a, b (removed), B (added), c
    expect([1, 2, 3, 4].map((row) => cell(row).text())).toEqual(['+', '+', '+', '+'])
    for (const row of [1, 2, 3]) await cell(row).trigger('pointerdown', { button: 0 })
    expect(pressed).toEqual([
      [1, 'modified'],
      [2, 'original'],
      [2, 'modified'],
    ])
  })
})

describe('DouCodeDiff annotations and collapsing', () => {
  it('keeps lines with a marker or widget in view, with context around them', async () => {
    const many = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
    const changedMany = [...many]
    changedMany[0] = 'LINE 1'
    const { wrapper } = setup({
      original: many.join('\n'),
      modelValue: changedMany.join('\n'),
      collapseUnchanged: { context: 1, minLines: 2 },
      gutters: [{ name: 'notes', markers: [{ side: 'original', line: 8, text: 'o' }] }],
      widgets: [{ id: 'w', side: 'modified', line: 15, render: () => h('p', '戴兜') }],
    })
    await nextTick()
    await nextTick()
    const bars = wrapper.findAll('.dou-code-diff__side.is-modified .dou-code-diff__bar')
    // 1 changed, 2 context, 3–6 hidden, 7–8 around 8, 9–13 hidden, 14–15 around 15, 16–20 hidden
    expect(bars.map((bar) => bar.text())).toEqual(['4 行未改动', '5 行未改动', '5 行未改动'])
    expect(wrapper.find('.dou-code-editor__cell[data-line="8"]').text()).toBe('o')
    expect(wrapper.find('.dou-code-diff__widget').text()).toBe('戴兜')
  })

  it('leaves lines with a marker shown only on hover to collapse', async () => {
    const many = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`)
    const changedMany = [...many]
    changedMany[100] = 'LINE 101'
    const everyLine = (['original', 'modified'] as const).flatMap((side) =>
      many.map((_, i) => ({ side, line: i + 1, text: '+', visible: 'hover' as const })),
    )
    const bars = async (gutters: unknown) => {
      const { wrapper } = setup({
        original: many.join('\n'),
        modelValue: changedMany.join('\n'),
        gutters,
      })
      await nextTick()
      await nextTick()
      const count = wrapper.findAll('.dou-code-diff__side.is-modified .dou-code-diff__bar').length
      wrapper.unmount()
      return count
    }
    expect(await bars([{ name: 'comments', markers: everyLine }])).toBe(2)
    expect(await bars([{ name: 'comments', hoverMarker: { text: '+', title: '评论' } }])).toBe(2)
  })

  it('warns once about a widget id used on both sides', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setup({
      widgets: [
        { id: 'dup', side: 'original', line: 1, render: () => h('p', '戴兜') },
        { id: 'dup', side: 'modified', line: 1, render: () => h('p', '上海') },
      ],
    })
    await nextTick()
    expect(warn.mock.calls.filter(([m]) => String(m).includes('"dup"'))).toHaveLength(1)
    expect(String(warn.mock.calls[0]![0])).toMatch(/^\[@dou-ui\/code\] DouCodeDiff/)
    warn.mockRestore()
  })

  it('reads out a widget across both sides on its own side too', async () => {
    const { wrapper } = setup({
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      widgets: [
        {
          id: 'both',
          side: 'modified',
          line: 3,
          span: 'both',
          label: '戴兜的评论',
          render: () => h('p', '戴兜'),
        },
      ],
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    const own = b!.find('.dou-code-editor__widget:has([data-diff-span])')
    expect(own.attributes('aria-label')).toBe('戴兜的评论')
    expect(a!.find('.dou-code-editor__widget:has([data-diff-span])').attributes('aria-label')).toBe(
      undefined,
    )
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
