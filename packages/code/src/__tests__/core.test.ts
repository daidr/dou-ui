import { describe, expect, it } from 'vitest'
import { ChangeSet } from '../core/changes'
import { clusterStarts, moveCluster, moveWord, wordAt } from '../core/chars'
import { CodeHistory } from '../core/history'
import { mapSelection, normalizeSelection, selectionOf } from '../core/selection'
import { CodeText } from '../core/text'
import { CodeTransaction } from '../core/transaction'
import { diffText } from '../view/input'

/** A small deterministic random source, so failures repeat. */
function random(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

const words = ['', 'a', 'const x = 1', '\n', '\n\n', 'foo\nbar', '你好', '😀', '\t', 'line\n']

/** Checks a text against the plain string it should hold, at a few random spots. */
function agrees(text: CodeText, str: string, next: () => number) {
  expect(text.toString()).toBe(str)
  const lines = str.split('\n')
  expect(text.lines).toBe(lines.length)
  const n = 1 + Math.floor(next() * lines.length)
  expect(text.line(n).text).toBe(lines[n - 1])
  const pos = Math.floor(next() * (str.length + 1))
  expect(text.lineAt(pos).number).toBe(str.slice(0, pos).split('\n').length)
  expect(text.widest).toBe(Math.max(...lines.map((line) => line.length)))
}

describe('CodeText', () => {
  it('finds lines by number and offset', () => {
    const text = CodeText.of('one\ntwo\n\nfour')
    expect(text.lines).toBe(4)
    expect(text.length).toBe(13)
    expect(text.line(2)).toEqual({ number: 2, from: 4, to: 7, text: 'two' })
    expect(text.lineAt(7).number).toBe(2)
    expect(text.lineAt(8)).toEqual({ number: 3, from: 8, to: 8, text: '' })
    expect(text.slice(2, 10)).toBe('e\ntwo\n\nf')
    expect(text.widest).toBe(4)
  })

  it('reads \\r\\n and \\r as line breaks', () => {
    expect(CodeText.of('a\r\nb\rc').toString()).toBe('a\nb\nc')
  })

  it('keeps old versions unchanged', () => {
    const a = CodeText.of('hello')
    const b = a.replace(5, 5, ' world')
    expect(a.toString()).toBe('hello')
    expect(b.toString()).toBe('hello world')
  })

  it('matches a plain string through many random edits, also on large texts', () => {
    const next = random(7)
    let str = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n')
    let text = CodeText.of(str)
    for (let i = 0; i < 2000; i++) {
      const from = Math.floor(next() * (str.length + 1))
      const to = Math.min(str.length, from + Math.floor(next() * (next() < 0.1 ? 4000 : 30)))
      let insert = words[Math.floor(next() * words.length)]!
      if (next() < 0.02) insert = Array.from({ length: 500 }, (_, k) => `x${k}`).join('\n')
      str = str.slice(0, from) + insert + str.slice(to)
      text = text.replace(from, to, insert)
      if (i % 97 === 0) agrees(text, str, next)
    }
    expect(text.toString()).toBe(str)
  })

  it('opens a large text quickly and edits it without rebuilding', () => {
    const str = Array.from(
      { length: 100_000 },
      (_, i) => `  const value${i} = compute(${i}) // ${i}`,
    ).join('\n')
    const start = performance.now()
    const text = CodeText.of(str)
    const opened = performance.now() - start
    expect(text.lines).toBe(100_000)
    const t = performance.now()
    let edited = text
    for (let i = 0; i < 1000; i++) edited = edited.replace(2_000_000 + i, 2_000_000 + i, 'x')
    const perEdit = (performance.now() - t) / 1000
    expect(edited.length).toBe(text.length + 1000)
    // Loose bounds: the bench measures the real numbers.
    expect(opened).toBeLessThan(500)
    expect(perEdit).toBeLessThan(1)
  })

  it('deletes everything down to one empty line', () => {
    const text = CodeText.of(Array.from({ length: 5000 }, () => 'x').join('\n'))
    const empty = text.replace(0, text.length, '')
    expect(empty.lines).toBe(1)
    expect(empty.toString()).toBe('')
  })
})

function randomChanges(length: number, next: () => number) {
  const specs = []
  let pos = 0
  while (pos < length && specs.length < 4) {
    const from = pos + Math.floor(next() * 4)
    if (from > length) break
    const to = Math.min(length, from + Math.floor(next() * 3))
    specs.push({
      from,
      to,
      insert: next() < 0.6 ? words[Math.floor(next() * words.length)]! : '',
    })
    pos = to + 1
  }
  return ChangeSet.of(specs, length)
}

describe('ChangeSet', () => {
  const text = CodeText.of('hello world')

  it('applies, inverts and maps', () => {
    const changes = ChangeSet.of(
      [
        { from: 6, to: 11, insert: 'there' },
        { from: 0, insert: '> ' },
      ],
      text.length,
    )
    const after = changes.apply(text)
    expect(after.toString()).toBe('> hello there')
    expect(changes.invert(text).apply(after).toString()).toBe('hello world')
    expect(changes.mapPos(0, -1)).toBe(0)
    expect(changes.mapPos(0, 1)).toBe(2)
    expect(changes.mapPos(5)).toBe(7)
    expect(changes.mapPos(8, -1)).toBe(8)
    expect(changes.mapPos(8, 1)).toBe(13)
    expect(changes.mapPos(11)).toBe(13)
  })

  it('refuses overlapping changes', () => {
    expect(() =>
      ChangeSet.of(
        [
          { from: 0, to: 4 },
          { from: 2, to: 6 },
        ],
        11,
      ),
    ).toThrow(RangeError)
  })

  it('composes like applying one after the other', () => {
    const next = random(3)
    for (let round = 0; round < 300; round++) {
      let str = 'abcdefghij\nklmnop\nqrst'
      const a = randomChanges(str.length, next)
      const doc = CodeText.of(str)
      const mid = a.apply(doc)
      const b = randomChanges(mid.length, next)
      const end = b.apply(mid)
      const both = a.compose(b)
      expect(both.apply(doc).toString()).toBe(end.toString())
      expect(both.invert(doc).apply(end).toString()).toBe(str)
      str = end.toString()
    }
  })
})

describe('selection', () => {
  it('sorts and joins overlapping ranges, keeping the main one', () => {
    const selection = normalizeSelection(
      {
        ranges: [
          { anchor: 10, head: 12 },
          { anchor: 0, head: 4 },
          { anchor: 3, head: 6 },
          { anchor: 12, head: 12 },
        ],
        main: 2,
      },
      20,
    )
    expect(selection.ranges).toEqual([
      { anchor: 0, head: 6 },
      { anchor: 10, head: 12 },
    ])
    expect(selection.main).toBe(0)
  })

  it('moves cursors along with typing', () => {
    const changes = ChangeSet.of({ from: 2, insert: 'xx' }, 10)
    expect(mapSelection(selectionOf(2), changes).ranges[0]).toEqual({ anchor: 4, head: 4 })
    expect(mapSelection(selectionOf(2, 5), changes).ranges[0]).toEqual({ anchor: 4, head: 7 })
  })
})

describe('transactions and history', () => {
  const state = {
    doc: CodeText.of('ab\ncd'),
    selection: {
      ranges: [
        { anchor: 1, head: 1 },
        { anchor: 4, head: 4 },
      ],
      main: 0,
    },
  }

  it('replaces every selection and leaves cursors after the text', () => {
    const result = new CodeTransaction(state).replaceSelection('X').resolve()
    expect(result.state.doc.toString()).toBe('aXb\ncXd')
    expect(result.state.selection.ranges).toEqual([
      { anchor: 2, head: 2 },
      { anchor: 6, head: 6 },
    ])
  })

  it('groups quick typing into one undo step', () => {
    const history = new CodeHistory()
    let current = state
    for (const [i, char] of ['x', 'y', 'z'].entries()) {
      const result = new CodeTransaction(current)
        .replaceSelection(char)
        .setMeta({ action: 'input' })
        .resolve()
      history.record(result, 1000 + i * 100)
      current = result.state
    }
    expect(current.doc.toString()).toBe('axyzb\ncxyzd')
    const step = history.undo()!
    expect(step.changes.apply(current.doc).toString()).toBe('ab\ncd')
    expect(step.selection).toEqual(state.selection)
    expect(history.canUndo).toBe(false)
  })

  it('starts a new step after a pause', () => {
    const history = new CodeHistory()
    let current = state
    for (const [i, time] of [0, 100, 2000].entries()) {
      const result = new CodeTransaction(current)
        .replaceSelection(String(i))
        .setMeta({ action: 'input' })
        .resolve()
      history.record(result, time)
      current = result.state
    }
    history.undo()
    expect(history.canUndo).toBe(true)
  })
})

describe('characters', () => {
  it('steps over emoji and combined characters as one', () => {
    const text = 'a👍🏽b'
    expect(moveCluster(text, 1, 1)).toBe(5)
    expect(moveCluster(text, 5, -1)).toBe(1)
    expect(clusterStarts('éx')).toEqual([0, 2, 3])
  })

  it('moves by words, splitting Chinese into words', () => {
    expect(moveWord('foo.bar baz', 0, 1)).toBe(3)
    expect(moveWord('foo.bar baz', 3, 1)).toBe(4)
    expect(moveWord('foo.bar baz', 7, 1)).toBe(11)
    expect(moveWord('foo bar', 7, -1)).toBe(4)
    const to = moveWord('我们今天写代码', 0, 1)
    expect(to).toBeGreaterThan(0)
    expect(to).toBeLessThan(7)
    expect(wordAt('let value = 1', 6)).toEqual({ from: 4, to: 9 })
  })
})

describe('diffText', () => {
  it('places a repeated character at the caret', () => {
    expect(diffText('aa', 'aaa', 1)).toEqual({ from: 1, to: 1, insert: 'a' })
    expect(diffText('aab', 'ab', 2)).toEqual({ from: 1, to: 2, insert: '' })
    expect(diffText('ab', 'ab')).toBeNull()
  })

  it('never splits a surrogate pair', () => {
    expect(diffText('😀', '😃', 2)).toEqual({ from: 0, to: 2, insert: '😃' })
  })
})
