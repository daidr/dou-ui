import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
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

  it('keeps the +/− column last in the gutter, after the columns of `gutters` and `extensions`', async () => {
    const own = defineCodeExtension({
      name: 'own',
      gutters: [{ name: 'own', markers: () => [{ line: 2, text: 'e' }] }],
    })
    const { wrapper } = setup({
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      gutters: [{ name: 'note', markers: [{ side: 'modified', line: 2, text: 'n' }] }],
      extensions: [own],
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    const row = (side: typeof a) =>
      side!.findAll('.dou-code-editor__number')[1]!.findAll('.dou-code-editor__cell')
    expect(row(b).map((cell) => cell.text())).toEqual(['n', 'e', '+'])
    expect(row(b).at(-1)!.classes()).toContain('dou-code-diff__sign')
    expect(row(a).at(-1)!.classes()).toContain('dou-code-diff__sign')
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
    .findAll('.dou-code-editor__widget-slot')
    .map((w) => /top:\s*([-\d.]+)px/.exec(w.attributes('style') ?? '')?.[1])

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

  it('answers only on markers with pressOn: markers', async () => {
    const pressed: unknown[] = []
    const { wrapper } = setup({
      original: 'a\nb\nc',
      modelValue: 'a\nB\nc',
      collapseUnchanged: false,
      gutters: [
        {
          name: 'comments',
          markers: [{ side: 'modified', line: 3, text: 'm', title: '戴兜的评论' }],
          pressOn: 'markers',
          onPress: (line: number, _event: Event, side: string) => pressed.push([line, side]),
        },
      ],
    })
    await nextTick()
    await nextTick()
    const [a, b] = wrapper.findAll('.dou-code-diff__side')
    expect(a!.find('[data-gutter-cell]').exists()).toBe(false)
    expect(b!.findAll('[data-gutter-cell]').map((c) => c.attributes('data-line'))).toEqual(['3'])
    await b!
      .get('[data-gutter-cell][data-line="3"]')
      .trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    expect(pressed).toEqual([[3, 'modified']])
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

describe('DouCodeDiff toolbar, sticky and collapse state', () => {
  it('renders the title slot before the stats when provided, and omits the wrapper otherwise', async () => {
    const { wrapper: plain } = setup()
    await nextTick()
    expect(plain.find('.dou-code-diff__title').exists()).toBe(false)

    const titled = mount(DouCodeDiff, {
      props: { original: 'a\nb', modelValue: 'a\nc', mode: 'split' },
      slots: { title: () => h('span', { class: 'path' }, 'src/shipping.ts') },
      attachTo: document.body,
    })
    await nextTick()
    const toolbar = titled.find('.dou-code-diff__toolbar')
    const children = [...toolbar.element.children]
    expect(children[0]!.classList.contains('dou-code-diff__title')).toBe(true)
    expect(children[0]!.textContent).toBe('src/shipping.ts')
    expect(children[1]!.classList.contains('dou-code-diff__stats')).toBe(true)

    const hidden = mount(DouCodeDiff, {
      props: { original: 'a', modelValue: 'b', toolbar: false },
      slots: { title: () => 'src/shipping.ts' },
      attachTo: document.body,
    })
    await nextTick()
    expect(hidden.find('.dou-code-diff__toolbar').exists()).toBe(false)
    expect(hidden.find('.dou-code-diff__title').exists()).toBe(false)
  })

  it('toggles sticky-toolbar class and uses clip + sticky rules in stylesheet', async () => {
    const sticky = ref(false)
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouCodeDiff, {
            original: 'a\nb',
            modelValue: 'a\nc',
            stickyToolbar: sticky.value,
          }),
      ),
      { attachTo: document.body },
    )
    await nextTick()
    expect(wrapper.find('.dou-code-diff__toolbar').classes()).not.toContain('is-sticky')
    sticky.value = true
    await nextTick()
    expect(wrapper.find('.dou-code-diff__toolbar').classes()).toContain('is-sticky')

    const css = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../style.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const diffStart = css.indexOf('.dou-code-diff {')
    const diffBlock = css.slice(diffStart, css.indexOf('.dou-code-diff__toolbar {', diffStart))
    expect(diffBlock).toMatch(/overflow:\s*clip/)
    expect(diffBlock).not.toMatch(/overflow:\s*hidden/)
    expect(diffBlock).toContain('--dou-code-diff-toolbar-bg')
    expect(diffBlock).toContain('--dou-code-diff-toolbar-top')

    const toolbarStart = css.indexOf('.dou-code-diff__toolbar {')
    const toolbarBlock = css.slice(
      toolbarStart,
      css.indexOf('.dou-code-diff__title {', toolbarStart),
    )
    expect(toolbarBlock).toMatch(/background-color:\s*var\(--dou-code-diff-toolbar-bg\)/)
    expect(toolbarBlock).toMatch(/position:\s*sticky/)
    expect(toolbarBlock).toMatch(/top:\s*var\(--dou-code-diff-toolbar-top\)/)
    expect(toolbarBlock).toMatch(/z-index:\s*\d+/)

    const titleStart = css.indexOf('.dou-code-diff__title {')
    const titleBlock = css.slice(titleStart, css.indexOf('}', titleStart))
    expect(titleBlock).toMatch(/text-overflow:\s*ellipsis/)
    expect(titleBlock).toMatch(/min-width:\s*0/)

    const bodyStart = css.indexOf('.dou-code-diff__body {')
    const bodyBlock = css.slice(bodyStart, css.indexOf('}', bodyStart))
    expect(bodyBlock).toMatch(/isolation:\s*isolate/)
  })

  it('exposes reactive read-only anyHideable and hiddenCount', async () => {
    const collapseUnchanged = ref<boolean>(true)
    const diff = ref<InstanceType<typeof DouCodeDiff>>()
    const wrapper = mount(
      defineComponent(() => {
        const snapshot = computed(() => ({
          anyHideable: diff.value?.anyHideable ?? false,
          hiddenCount: diff.value?.hiddenCount ?? 0,
        }))
        return () =>
          h('div', [
            h('output', JSON.stringify(snapshot.value)),
            h(DouCodeDiff, {
              ref: diff,
              original,
              modelValue: changed,
              mode: 'split',
              collapseUnchanged: collapseUnchanged.value,
            }),
          ])
      }),
      { attachTo: document.body },
    )
    await nextTick()
    await nextTick()

    expect(diff.value!.anyHideable).toBe(true)
    expect(diff.value!.hiddenCount).toBe(10)
    expect(wrapper.find('output').text()).toBe(
      JSON.stringify({ anyHideable: true, hiddenCount: 10 }),
    )

    // Read-only exposed getters reject writes in strict mode.
    expect(() => {
      ;(diff.value as unknown as { hiddenCount: number }).hiddenCount = 0
    }).toThrow(TypeError)
    expect(() => {
      ;(diff.value as unknown as { anyHideable: boolean }).anyHideable = false
    }).toThrow(TypeError)

    diff.value!.expandAll()
    await nextTick()
    expect(diff.value!.anyHideable).toBe(true)
    expect(diff.value!.hiddenCount).toBe(0)
    expect(wrapper.find('output').text()).toBe(
      JSON.stringify({ anyHideable: true, hiddenCount: 0 }),
    )

    diff.value!.collapseAll()
    await nextTick()
    expect(diff.value!.anyHideable).toBe(true)
    expect(diff.value!.hiddenCount).toBe(10)
    expect(wrapper.find('output').text()).toBe(
      JSON.stringify({ anyHideable: true, hiddenCount: 10 }),
    )

    // Opening a single collapse bar updates hiddenCount while keeping anyHideable true.
    await wrapper.find('.dou-code-diff__bar').trigger('click')
    await nextTick()
    expect(diff.value!.anyHideable).toBe(true)
    expect(diff.value!.hiddenCount).toBe(0)

    collapseUnchanged.value = false
    await nextTick()
    expect(diff.value!.anyHideable).toBe(false)
    expect(diff.value!.hiddenCount).toBe(0)
    expect(wrapper.find('output').text()).toBe(
      JSON.stringify({ anyHideable: false, hiddenCount: 0 }),
    )
  })

  it('reports anyHideable=false when no unchanged run is long enough to collapse', async () => {
    const short = setup({ original: 'a\nb\nc\nd\ne', modelValue: 'a\nb\nC\nd\ne' })
    await nextTick()
    expect(short.diff.value!.anyHideable).toBe(false)
    expect(short.diff.value!.hiddenCount).toBe(0)
    // Only previous, next and view toggle are shown when nothing can collapse.
    expect(short.wrapper.findAll('.dou-code-diff__toolbar button')).toHaveLength(3)

    const same = setup({ original, modelValue: original })
    await nextTick()
    expect(same.diff.value!.anyHideable).toBe(false)
    expect(same.diff.value!.hiddenCount).toBe(0)
  })
})

describe('DouCodeDiff gutter width, compact layout and overlay actions', () => {
  const longOriginal = Array.from({ length: 233 }, (_, i) => `const line${i + 1} = ${i + 1}`).join(
    '\n',
  )
  const longModified = longOriginal.replace('const line120 = 120', 'const line120 = 999')

  it('computes tight inline gutter widths with zero trailing dead space and switches to compact under 480px', async () => {
    const callbacks: Array<(entries: Array<{ contentRect: { width: number } }>) => void> = []
    const origRO = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(cb: (entries: Array<{ contentRect: { width: number } }>) => void) {
        callbacks.push(cb)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver

    try {
      const { wrapper } = setup({
        mode: 'inline',
        original: longOriginal,
        modelValue: longModified,
        collapseUnchanged: false,
      })
      await nextTick()
      await nextTick()

      const root = wrapper.get('.dou-code-diff')
      const editor = wrapper.get('.dou-code-editor')
      // Normal inline (3-digit file): 35 (orig) + 31 (mod) + 16 (sign) = 82px (no +12px dead space)
      expect(root.classes()).not.toContain('is-compact')
      expect(editor.attributes('style')).toContain('--dou-code-editor-gutter: 82px')
      const firstRowCells = wrapper
        .findAll('.dou-code-editor__number')[0]!
        .findAll('.dou-code-editor__cell')
      expect(firstRowCells.map((c) => c.attributes('style'))).toEqual([
        'width: 35px;',
        'width: 31px;',
        'width: 16px;',
      ])

      // Narrow container (375px < 480px): switches to compact layout (29 + 27 + 14 = 70px)
      for (const cb of callbacks) cb([{ contentRect: { width: 375 } }])
      await nextTick()
      await nextTick()
      expect(root.classes()).toContain('is-compact')
      expect(editor.attributes('style')).toContain('--dou-code-editor-gutter: 70px')
      const compactCells = wrapper
        .findAll('.dou-code-editor__number')[0]!
        .findAll('.dou-code-editor__cell')
      expect(compactCells.map((c) => c.attributes('style'))).toEqual([
        'width: 29px;',
        'width: 27px;',
        'width: 14px;',
      ])

      // Wide container again (640px >= 480px): exits compact layout
      for (const cb of callbacks) cb([{ contentRect: { width: 640 } }])
      await nextTick()
      await nextTick()
      expect(root.classes()).not.toContain('is-compact')
      expect(editor.attributes('style')).toContain('--dou-code-editor-gutter: 82px')
    } finally {
      globalThis.ResizeObserver = origRO
    }
  })

  it('supports overlay gutters (always and compact-only) without occupying column width', async () => {
    const callbacks: Array<(entries: Array<{ contentRect: { width: number } }>) => void> = []
    const origRO = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(cb: (entries: Array<{ contentRect: { width: number } }>) => void) {
        callbacks.push(cb)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver

    try {
      const pressed: unknown[] = []
      const alwaysOverlay = setup({
        mode: 'inline',
        original: 'a\nb\nc',
        modelValue: 'a\nB\nc',
        collapseUnchanged: false,
        gutters: [
          {
            name: 'comments',
            width: 18,
            overlay: true,
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

      // 1-digit inline: 20 (orig) + 16 (mod) + 16 (sign) = 52px; overlay gutter adds 0px
      expect(alwaysOverlay.wrapper.get('.dou-code-editor').attributes('style')).toContain(
        '--dou-code-editor-gutter: 52px',
      )
      // Rows: 1 (a, shared), 2 (b, removed), 3 (B, added), 4 (c, shared) -> modified-only overlay skips row 2
      const overlayCells = alwaysOverlay.wrapper.findAll('.dou-code-editor__cell.is-overlay')
      expect(overlayCells.map((el) => el.attributes('data-line'))).toEqual(['1', '3', '4'])
      await overlayCells[1]!.trigger('pointerdown', { button: 0, pointerType: 'mouse' })
      expect(pressed).toEqual([[2, 'modified']])
      alwaysOverlay.wrapper.unmount()

      // overlay: 'compact' stays a flow column when wide and collapses to overlay under 480px
      callbacks.length = 0
      const responsive = setup({
        mode: 'inline',
        original: 'a\nb\nc',
        modelValue: 'a\nB\nc',
        collapseUnchanged: false,
        gutters: [
          {
            name: 'comments',
            width: 18,
            overlay: 'compact',
            hoverMarker: { text: '+', title: '添加评论' },
            onPress: () => {},
          },
        ],
      })
      await nextTick()
      await nextTick()
      // Wide: 18 + 20 + 16 + 16 = 70px, rendered in flow cells
      expect(responsive.wrapper.get('.dou-code-editor').attributes('style')).toContain(
        '--dou-code-editor-gutter: 70px',
      )
      expect(responsive.wrapper.findAll('.dou-code-editor__cell.is-overlay')).toHaveLength(0)

      // Narrow (375px): 15 (orig) + 13 (mod) + 14 (sign) = 42px, rendered as overlay
      for (const cb of callbacks) cb([{ contentRect: { width: 375 } }])
      await nextTick()
      await nextTick()
      expect(responsive.wrapper.get('.dou-code-editor').attributes('style')).toContain(
        '--dou-code-editor-gutter: 42px',
      )
      expect(responsive.wrapper.findAll('.dou-code-editor__cell.is-overlay')).toHaveLength(4)
    } finally {
      globalThis.ResizeObserver = origRO
    }
  })

  it('defines compact gutter padding and tightened split/inline spacing in stylesheet', () => {
    const css = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../style.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toContain('--dou-code-editor-gutter-padding-left: 6px')
    expect(css).toContain('--dou-code-editor-gutter-padding-right: 8px')
    expect(css).toContain('--dou-code-editor-padding-x: 6px')
    expect(css).toContain('.dou-code-editor__overlays')
    expect(css).toContain('.dou-code-editor__cell.is-overlay')
    expect(css).toContain('.dou-code-diff.is-compact')
  })
})

const longLines = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}: ${'segment_'.repeat(24)}end`).join('\n')

describe('DouCodeDiff sticky widgets and horizontal scroll', () => {
  it('spans collapse bars and fillers across the gutter in split and inline modes', async () => {
    const beforeText = `${longLines(1, 'removed')}\n${longLines(14, 'same')}`
    const afterText = `${longLines(3, 'added')}\n${longLines(14, 'same')}`
    const { wrapper } = setup({ original: beforeText, modelValue: afterText, mode: 'split' })
    await nextTick()
    await nextTick()

    const barWidgets = wrapper.findAll('.dou-code-editor__widget:has(.dou-code-diff__bar)')
    expect(barWidgets).toHaveLength(2)
    for (const barWidget of barWidgets) {
      expect(barWidget.classes()).toContain('is-full-width')
      expect(barWidget.element.parentElement?.classList.contains('is-full-width')).toBe(true)
    }
    const fillerWidget = wrapper.find('.dou-code-editor__widget:has(.dou-code-diff__filler)')
    expect(fillerWidget.exists()).toBe(true)
    expect(fillerWidget.classes()).toContain('is-full-width')

    // Inline mode also spans the collapse bar across both line-number columns and the sign column.
    const inline = setup({ original: beforeText, modelValue: afterText, mode: 'inline' })
    await nextTick()
    await nextTick()
    const inlineBar = inline.wrapper.find('.dou-code-editor__widget:has(.dou-code-diff__bar)')
    expect(inlineBar.exists()).toBe(true)
    expect(inlineBar.classes()).toContain('is-full-width')
    expect(inlineBar.element.parentElement?.classList.contains('is-full-width')).toBe(true)
  })

  it('keeps collapse bars and spanning widgets stable during horizontal scroll', async () => {
    const beforeText = `${longLines(1, 'old')}\n${longLines(14, 'same')}`
    const afterText = `${longLines(1, 'new')}\n${longLines(14, 'same')}`
    const { wrapper } = setup({
      original: beforeText,
      modelValue: afterText,
      mode: 'split',
      widgets: [
        {
          id: 'note-side',
          side: 'modified',
          line: 1,
          render: () => h('p', '单侧评论'),
        },
        {
          id: 'note-both',
          side: 'modified',
          line: 2,
          span: 'both',
          render: () => h('p', '跨栏评论'),
        },
      ],
    })
    await nextTick()
    await nextTick()

    const scrollers = wrapper.findAll('.dou-code-editor__scroller')
    const [scrollerA, scrollerB] = scrollers.map((s) => s.element as HTMLElement)
    for (const scroller of [scrollerA!, scrollerB!]) {
      Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 })
      Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 1400 })
      Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 })
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 800 })
    }

    const span = wrapper.get('.dou-code-diff__span')
    expect(span.classes()).toContain('is-placed')

    // Horizontal scroll must not write inline transforms onto widgets or hide spanning widgets.
    scrollerA!.scrollLeft = 220
    await scrollers[0]!.trigger('scroll')
    await nextTick()

    expect(scrollerB!.scrollLeft).toBe(220)
    for (const widget of wrapper.findAll('.dou-code-editor__widget')) {
      expect(widget.attributes('style')).toBeUndefined()
    }
    expect(span.classes()).toContain('is-placed')

    // Vertical scroll still hides spanning widgets until scrolling settles.
    scrollerA!.scrollTop = 60
    await scrollers[0]!.trigger('scroll')
    await nextTick()
    expect(span.classes()).not.toContain('is-placed')
  })

  it('keeps dynamically added spanning widgets visible on the first horizontal scroll', async () => {
    const beforeText = `${longLines(1, 'old')}\n${longLines(14, 'same')}`
    const afterText = `${longLines(1, 'new')}\n${longLines(14, 'same')}`
    const widgets = ref<
      Array<{
        id: string
        side: 'original' | 'modified'
        line: number
        span: 'both'
        render: () => ReturnType<typeof h>
      }>
    >([])
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouCodeDiff, {
            original: beforeText,
            modelValue: afterText,
            mode: 'split',
            widgets: widgets.value,
          }),
      ),
      { attachTo: document.body },
    )
    await nextTick()
    await nextTick()

    const scrollers = wrapper.findAll('.dou-code-editor__scroller')
    const [scrollerA, scrollerB] = scrollers.map((s) => s.element as HTMLElement)
    for (const scroller of [scrollerA!, scrollerB!]) {
      Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 })
      Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 1400 })
      Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 })
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 800 })
    }

    // 1. Scroll vertically while there are no spanning widgets, then add one and scroll horizontally.
    scrollerA!.scrollTop = 80
    await scrollers[0]!.trigger('scroll')
    await nextTick()

    widgets.value = [
      { id: 'dyn-1', side: 'modified', line: 2, span: 'both', render: () => h('p', '动态跨栏') },
    ]
    await nextTick()
    await nextTick()
    expect(wrapper.get('.dou-code-diff__span').classes()).toContain('is-placed')

    scrollerA!.scrollLeft = 180
    await scrollers[0]!.trigger('scroll')
    await nextTick()
    expect(wrapper.get('.dou-code-diff__span').classes()).toContain('is-placed')

    // 2. Remove all spanning widgets, scroll vertically elsewhere, re-add one, then scroll horizontally.
    widgets.value = []
    await nextTick()
    scrollerA!.scrollTop = 140
    await scrollers[0]!.trigger('scroll')
    await nextTick()

    widgets.value = [
      { id: 'dyn-2', side: 'modified', line: 2, span: 'both', render: () => h('p', '再次跨栏') },
    ]
    await nextTick()
    await nextTick()
    expect(wrapper.get('.dou-code-diff__span').classes()).toContain('is-placed')

    scrollerA!.scrollLeft = 260
    await scrollers[0]!.trigger('scroll')
    await nextTick()
    expect(wrapper.get('.dou-code-diff__span').classes()).toContain('is-placed')
  })
})
