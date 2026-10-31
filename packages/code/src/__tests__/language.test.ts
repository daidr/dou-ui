import { describe, expect, it } from 'vitest'
import {
  CodeHighlighter,
  type CodeLanguage,
  type CodeSelection,
  type CodeState,
  CodeText,
  CodeTransaction,
  codeCommands,
  createCodeHighlighter,
  createMarkdown,
  css,
  defineCodeLanguage,
  html,
  javascript,
  json,
  lineParts,
  matchBracket,
  scss,
  tokenizeLine,
  tsx,
  typescript,
  vue,
} from '../index'
import type { CodeCommand, CodeCommandTarget } from '../core/commands'
import { ChangeSet } from '../core/changes'

/** A text's tokens as `[kind:text]`, plain text as is, lines joined by `\n`. */
function marked(language: CodeLanguage, source: string) {
  const state = language.startState()
  return source
    .split('\n')
    .map((line) =>
      lineParts(line, tokenizeLine(language, line, state))
        .map(([text, kind]) => (kind ? `[${kind}:${text}]` : text))
        .join(''),
    )
    .join('\n')
}

describe('languages', () => {
  it('reads JavaScript and TypeScript', () => {
    expect(marked(typescript, `const total = (n: number) => n / 2 // half`)).toBe(
      '[keyword:const] [function:total] [operator:=] [punctuation:(][variable:n][operator::] [type:number][punctuation:)] [operator:=>] [variable:n] [operator:/] [number:2] [comment:// half]',
    )
    // A `/` where an expression starts is a regular expression.
    expect(marked(javascript, `x = /a+b/g`)).toBe('[variable:x] [operator:=] [string:/a+b/g]')
    expect(marked(javascript, 'const s = `hi ${name.trim()}!`')).toBe(
      '[keyword:const] [variable:s] [operator:=] [string:`hi ][punctuation:${][variable:name][punctuation:.][function:trim][punctuation:()}][string:!`]',
    )
    expect(marked(typescript, `interface Order { cups: number; name?: string }`)).toBe(
      '[keyword:interface] [type:Order] [punctuation:{] [property:cups][operator::] [type:number][punctuation:;] [property:name][operator:?:] [type:string] [punctuation:}]',
    )
  })

  it('carries comments and template strings across lines', () => {
    expect(marked(javascript, `/* one\ntwo */ a\nb = \`x\ny\``)).toBe(
      '[comment:/* one]\n[comment:two */] [variable:a]\n[variable:b] [operator:=] [string:`x]\n[string:y`]',
    )
  })

  it('reads JSX tags inside code', () => {
    expect(marked(tsx, `const el = <div className="a" onClick={go}>Hi {name}</div>`)).toBe(
      '[keyword:const] [variable:el] [operator:=] [tag:<div] [attribute:className][operator:=][string:"a"] [attribute:onClick][operator:=][punctuation:{][variable:go][punctuation:}][tag:>]Hi [punctuation:{][variable:name][punctuation:}][tag:</div>]',
    )
    // Without JSX, `<` is a comparison.
    expect(marked(typescript, `a < b`)).toBe('[variable:a] [operator:<] [variable:b]')
  })

  it('reads JSON', () => {
    expect(marked(json, `{ "a": [1, true], "b": "x" }`)).toBe(
      '[punctuation:{] [property:"a"][punctuation::] [punctuation:[][number:1][punctuation:,] [keyword:true][punctuation:],] [property:"b"][punctuation::] [string:"x"] [punctuation:}]',
    )
  })

  it('reads CSS selectors, properties and values', () => {
    expect(marked(css, `.a:hover > b { color: #fff; margin: 0 4px !important }`)).toBe(
      '[type:.a][keyword::hover] [operator:>] [tag:b] [punctuation:{] [property:color][punctuation::] [number:#fff][punctuation:;] [property:margin][punctuation::] [number:0] [number:4px] [keyword:!important] [punctuation:}]',
    )
    // Nested rules: `a:hover {` inside a block is a selector, not a property.
    expect(marked(scss, `.a { a:hover { $x: 1 } }`)).toBe(
      '[type:.a] [punctuation:{] [tag:a][keyword::hover] [punctuation:{] [property:$x][punctuation::] [number:1] [punctuation:}] [punctuation:}]',
    )
  })

  it('reads HTML with scripts and styles in their own languages', () => {
    expect(
      marked(
        html,
        `<p class="a">x &amp; y</p>\n<script>\nlet a = '</p>'\n</script>\n<style>a { b: 1 }</style>`,
      ),
    ).toBe(
      [
        '[tag:<p] [attribute:class][operator:=][string:"a"][tag:>]x [meta:&amp;] y[tag:</p>]',
        '[tag:<script>]',
        "[keyword:let] [variable:a] [operator:=] [string:'</p>']",
        '[tag:</script>]',
        '[tag:<style>a] [punctuation:{] [property:b][punctuation::] [number:1] [punctuation:}][tag:</style>]',
      ].join('\n'),
    )
  })

  it('reads Vue expressions and the script language it asks for', () => {
    expect(
      marked(
        vue,
        `<a :href="url" @click="n++">{{ n + 1 }}</a>\n<script setup lang="ts">\nlet n: number\n</script>`,
      ),
    ).toBe(
      [
        '[tag:<a] [attribute::href][operator:=][string:"][variable:url][string:"] [attribute:@click][operator:=][string:"][variable:n][operator:++][string:"][tag:>][punctuation:{{] [variable:n] [operator:+] [number:1] [punctuation:}}][tag:</a>]',
        '[tag:<script] [attribute:setup] [attribute:lang][operator:=][string:"ts"][tag:>]',
        '[keyword:let] [variable:n][operator::] [type:number]',
        '[tag:</script>]',
      ].join('\n'),
    )
  })

  it('reads Markdown with fenced code in the languages it is given', () => {
    const md = createMarkdown({ code: [typescript] })
    expect(
      marked(md, '# Title\nA **b** *c* `d` [e](f)\n- item\n```ts\nlet a = 1\n```\n```sh\nls\n```'),
    ).toBe(
      [
        '[heading:# Title]',
        'A [strong:**b**] [emphasis:*c*] [string:`d`] [link:[e](f)]',
        '[keyword:-] item',
        '[meta:```ts]',
        '[keyword:let] [variable:a] [operator:=] [number:1]',
        '[meta:```]',
        '[meta:```sh]',
        '[string:ls]',
        '[meta:```]',
      ].join('\n'),
    )
  })

  it('defines a language from a tokenizer', () => {
    const ini = defineCodeLanguage({
      name: 'ini',
      token(stream) {
        if (stream.sol() && stream.match(/^\s*;.*$/)) return 'comment'
        if (stream.match(/^\[[^\]]*\]/)) return 'keyword'
        if (stream.match(/^[\w.-]+(?=\s*=)/)) return 'property'
        stream.next()
        return null
      },
    })
    expect(marked(ini, '[app]\n; note\nname = 戴兜')).toBe(
      '[keyword:[app]]\n[comment:; note]\n[property:name] = 戴兜',
    )
  })

  it('highlights code block HTML with the same classes', () => {
    const highlight = createCodeHighlighter([javascript])
    expect(highlight('let a = "<b>"', 'js')).toBe(
      '<span class="line"><span class="dou-syntax-keyword">let</span> <span class="dou-syntax-variable">a</span> <span class="dou-syntax-operator">=</span> <span class="dou-syntax-string">&quot;&lt;b&gt;&quot;</span></span>',
    )
    expect(highlight('a < b', 'nope')).toBe('<span class="line">a &lt; b</span>')
  })
})

/** Every line's tokens as the highlighter has them, and as reading the text afresh gives them. */
function compare(hl: CodeHighlighter, doc: CodeText) {
  const state = tsx.startState()
  const fresh = Array.from({ length: doc.lines }, (_, i) =>
    tokenizeLine(tsx, doc.line(i + 1).text, state),
  )
  return [Array.from({ length: doc.lines }, (_, i) => hl.line(i + 1)), fresh] as const
}

describe('CodeHighlighter', () => {
  const sample = [
    'const a = 1 /* one',
    'two */ let b = `x',
    '${a}`',
    '<div>{b}</div>',
    'function f() {',
    '  return "s" // c',
    '}',
  ]

  it('keeps tokens right through random edits, reading only what is asked', () => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const pieces = ['/*', '*/', '`', '${', '}', '\n', 'x', ' ', '"', '//', '<a>', '</a>', '{']
    let doc = CodeText.of(
      Array.from({ length: 30 }, (_, i) => sample[i % sample.length]).join('\n'),
    )
    const hl = new CodeHighlighter(tsx, doc)
    const checks: Array<ReturnType<typeof compare>> = []
    for (let round = 0; round < 300; round++) {
      const from = Math.floor(random() * (doc.length + 1))
      const to = Math.min(doc.length, from + Math.floor(random() * 6))
      const insert = random() < 0.3 ? '' : pieces[Math.floor(random() * pieces.length)]!
      const changes = ChangeSet.of([{ from, to, insert }], doc.length)
      doc = changes.apply(doc)
      hl.update(doc, changes)
      // Read a random line now and then, so edits land before, inside and after what is read.
      if (random() < 0.5) hl.line(1 + Math.floor(random() * doc.lines))
      if (round % 10 === 0) checks.push(compare(hl, doc))
    }
    for (const [read, fresh] of checks) expect(read).toEqual(fresh)
  })

  it('stops rereading once a line starts as it did before', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `let a${i} = ${i}`)
    let doc = CodeText.of(lines.join('\n'))
    const hl = new CodeHighlighter(javascript, doc)
    hl.line(1000)
    const changes = ChangeSet.of([{ from: 4, to: 4, insert: 'x' }], doc.length)
    doc = changes.apply(doc)
    hl.update(doc, changes)
    hl.line(2)
    expect(hl.frontier).toBe(1000)
  })

  it('leaves lines far ahead for later', () => {
    const doc = CodeText.of(Array.from({ length: 5000 }, () => 'a').join('\n'))
    const hl = new CodeHighlighter(javascript, doc)
    expect(hl.line(4000, 100)).toBeNull()
    expect(hl.work(Infinity, 4000)).toBe(true)
    expect(hl.line(4000, 100)).not.toBeNull()
  })

  it('knows the language inside another', () => {
    const doc = CodeText.of('<template>\n<p></p>\n</template>\n<script>\nlet a\n</script>')
    const hl = new CodeHighlighter(vue, doc)
    expect(hl.languageAt(2).name).toBe('vue')
    expect(hl.languageAt(5).name).toBe('javascript')
  })
})

describe('matchBracket', () => {
  it('finds the partner, skipping what `skip` rules out', () => {
    const doc = CodeText.of('f(a, ")", [b])')
    expect(matchBracket(doc, 1, '()[]{}')).toEqual({ from: 1, match: 6 })
    expect(matchBracket(doc, 1, '()[]{}', (pos) => pos >= 5 && pos <= 7)).toEqual({
      from: 1,
      match: 13,
    })
    expect(matchBracket(doc, 0, '()[]{}')).toBeNull()
    expect(matchBracket(CodeText.of('(a'), 0, '()')).toEqual({ from: 0, match: null })
  })
})

/** Runs a command on text where `|` marks the cursor (twice for a selection: anchor, head). */
function apply(
  command: CodeCommand | ((target: CodeCommandTarget) => boolean),
  source: string,
  options: { language?: CodeLanguage; closeBrackets?: boolean } = {},
) {
  const parts = source.split('|')
  const text = parts.join('')
  const anchor = parts[0]!.length
  const head = parts.length > 2 ? anchor + parts[1]!.length : anchor
  let state: CodeState = {
    doc: CodeText.of(text),
    selection: { ranges: [{ anchor, head }], main: 0 },
  }
  const language = options.language ?? typescript
  const target: CodeCommandTarget = {
    get state() {
      return state
    },
    readonly: false,
    tabSize: 2,
    indentWithTabs: false,
    pageLines: 10,
    language,
    closeBrackets: options.closeBrackets ?? true,
    transaction: () => new CodeTransaction(state),
    dispatch: (tr) => (state = tr.resolve().state),
    moveVertically: (range) => range.head,
    undo: () => false,
    redo: () => false,
    languageAt: (pos) => {
      const hl = new CodeHighlighter(language, state.doc)
      return hl.languageAt(state.doc.lineAt(pos).number)
    },
    syntaxAt: (pos) => {
      if (pos < 0 || pos >= state.doc.length) return null
      const hl = new CodeHighlighter(language, state.doc)
      const line = state.doc.lineAt(pos)
      let at = line.from
      for (const [part, kind] of lineParts(line.text, hl.line(line.number))) {
        if (pos < at + part.length) return kind
        at += part.length
      }
      return null
    },
  }
  const ran = command(target)
  return { ran, text: show(state.doc.toString(), state.selection) }
}

const show = (text: string, selection: CodeSelection) => {
  const marks = selection.ranges.flatMap((range) =>
    range.anchor === range.head ? [range.head] : [range.anchor, range.head],
  )
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  marks.sort((a, b) => b - a)
  for (const pos of marks) text = text.slice(0, pos) + '|' + text.slice(pos)
  return text
}

const typing = (ch: string) => (target: CodeCommandTarget) => codeCommands.insertText(target, ch)

describe('editing commands', () => {
  it('indents after an opening bracket and splits a pair', () => {
    expect(apply(codeCommands.insertNewline, '  if (a) {|').text).toBe('  if (a) {\n    |')
    expect(apply(codeCommands.insertNewline, 'f(|)').text).toBe('f(\n  |\n)')
    expect(apply(codeCommands.insertNewline, '  a|').text).toBe('  a\n  |')
    // A bracket inside a string opens nothing.
    expect(apply(codeCommands.insertNewline, "a = '{|").text).toBe("a = '{\n|")
    expect(apply(codeCommands.insertNewline, '<div>|</div>', { language: html }).text).toBe(
      '<div>\n  |\n</div>',
    )
  })

  it('types bracket and quote pairs, and steps over closers', () => {
    expect(apply(typing('('), 'f|').text).toBe('f(|)')
    expect(apply(typing(')'), 'f(|)').text).toBe('f()|')
    expect(apply(typing('"'), 'a = |').text).toBe('a = "|"')
    // Not after a letter, so it's and don't stay as typed.
    expect(apply(typing("'"), 'it|').ran).toBe(false)
    // Not before a word.
    expect(apply(typing('('), '|abc').ran).toBe(false)
    // Wraps a selection and keeps it selected.
    expect(apply(typing('['), '|abc|').text).toBe('[|abc|]')
    expect(apply(typing('('), 'f|', { closeBrackets: false }).ran).toBe(false)
  })

  it('deletes both halves of an empty pair', () => {
    expect(apply(codeCommands.deleteCharBackward, 'f(|)').text).toBe('f|')
    expect(apply(codeCommands.deleteCharBackward, 'f(|a)').text).toBe('f|a)')
    expect(apply(codeCommands.deleteCharBackward, 'f(|)', { closeBrackets: false }).text).toBe(
      'f|)',
    )
  })

  it('lines a closing bracket typed on a blank line up with its opener', () => {
    expect(apply(typing('}'), 'if (a) {\n  b\n    |').text).toBe('if (a) {\n  b\n}|')
  })

  it('toggles line comments at the smallest indentation', () => {
    expect(apply(codeCommands.toggleComment, '  |a\n    b|').text).toBe('  // |a\n  //   b|')
    expect(apply(codeCommands.toggleComment, '  // |a').text).toBe('  |a')
    expect(apply(codeCommands.toggleComment, '|a {}|', { language: css }).text).toBe('/* |a {}| */')
    expect(apply(codeCommands.toggleComment, '/* |a {} */', { language: css }).text).toBe('|a {}')
  })

  it('comments with the language at the cursor', () => {
    expect(
      apply(codeCommands.toggleComment, '<script>\nlet |a\n</script>', { language: vue }).text,
    ).toBe('<script>\n// let |a\n</script>')
    expect(apply(codeCommands.toggleComment, '<p>|a</p>', { language: vue }).text).toBe(
      '<!-- <p>|a</p> -->',
    )
  })

  it('moves, copies and deletes lines', () => {
    expect(apply(codeCommands.moveLineUp, 'a\nb|').text).toBe('b|\na')
    expect(apply(codeCommands.moveLineDown, 'a|\nb\nc').text).toBe('b\na|\nc')
    expect(apply(codeCommands.moveLineUp, 'a|\nb').ran).toBe(false)
    expect(apply(codeCommands.copyLineDown, 'a|\nb').text).toBe('a\na|\nb')
    expect(apply(codeCommands.copyLineUp, 'a|\nb').text).toBe('a|\na\nb')
    expect(apply(codeCommands.deleteLine, 'a\nb|\nc').text).toBe('a\n|c')
    expect(apply(codeCommands.deleteLine, 'a\nb|').text).toBe('a|')
  })

  it('jumps to the matching bracket', () => {
    expect(apply(codeCommands.cursorMatchingBracket, 'f|(a, [b])').text).toBe('f(a, [b]|)')
    expect(apply(codeCommands.cursorMatchingBracket, 'f(a, [b])|').text).toBe('f|(a, [b])')
  })
})
