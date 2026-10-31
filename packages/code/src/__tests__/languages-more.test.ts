import { createHighlighter } from 'shiki'
import { describe, expect, it } from 'vitest'
import {
  type CodeLanguage,
  CodeHighlighter,
  CodeText,
  lineParts,
  python,
  shell,
  sql,
  tokenizeLine,
  yaml,
} from '../index'
import { shikiLanguage, tokenTypeOfScopes } from '../shiki'

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

describe('more languages', () => {
  it('reads Python', () => {
    expect(marked(python, `@dataclass\nclass Order(Base):`)).toBe(
      '[meta:@dataclass]\n[keyword:class] [type:Order][punctuation:(][type:Base][punctuation:):]',
    )
    expect(marked(python, `def total(self, rate: float = 0.5) -> int:`)).toBe(
      '[keyword:def] [function:total][punctuation:(][variable:self][punctuation:,] [variable:rate][punctuation::] [type:float] [operator:=] [number:0.5][punctuation:)] [operator:->] [type:int][punctuation::]',
    )
    // triple-quoted strings run across lines; `match` is a keyword only as a statement
    expect(marked(python, `s = """一\n二""" # 注释\nmatch = 3`)).toBe(
      '[variable:s] [operator:=] [string:"""一]\n[string:二"""] [comment:# 注释]\n[variable:match] [operator:=] [number:3]',
    )
    expect(marked(python, `print(f"hi {name}", self.items)`)).toBe(
      '[function:print][punctuation:(][string:f"hi {name}"][punctuation:,] [variable:self][punctuation:.][property:items][punctuation:)]',
    )
  })

  it('reads shell scripts', () => {
    expect(marked(shell, `NAME="戴兜 $USER"`)).toBe(
      '[variable:NAME][operator:=][string:"戴兜 ][variable:$USER][string:"]',
    )
    expect(marked(shell, `if [ -f ./a ]; then echo hi | grep -i h > out; fi`)).toBe(
      '[keyword:if] [punctuation:[] [attribute:-f] ./a [punctuation:]][operator:;] [keyword:then] [keyword:echo] hi [operator:|] [function:grep] [attribute:-i] h [operator:>] out[operator:;] [keyword:fi]',
    )
    // a here-document is text up to its end word
    expect(marked(shell, `cat <<EOF\nraw $x\nEOF\nls`)).toBe(
      '[function:cat] [operator:<<EOF]\n[string:raw $x]\n[string:EOF]\n[function:ls]',
    )
  })

  it('reads SQL in any case', () => {
    expect(marked(sql, `select o.id, count(*) from orders o where o.city = '上海' -- 订单`)).toBe(
      "[keyword:select] [variable:o][punctuation:.][property:id][punctuation:,] [function:count][punctuation:(][operator:*][punctuation:)] [keyword:from] [variable:orders] [variable:o] [keyword:where] [variable:o][punctuation:.][property:city] [operator:=] [string:'上海'] [comment:-- 订单]",
    )
    expect(marked(sql, `/* a\nb */ LIMIT $1::INT`)).toBe(
      '[comment:/* a]\n[comment:b */] [keyword:LIMIT] [variable:$1][operator:::][type:INT]',
    )
  })

  it('reads YAML, with block text and anchors', () => {
    expect(
      marked(
        yaml,
        `name: 读书会 # 名字\nseats: 24\nhosts:\n  - &a 阿青\nnote: |\n  多行\nnext: *a`,
      ),
    ).toBe(
      '[property:name][punctuation::] [string:读书会] [comment:# 名字]\n[property:seats][punctuation::] [number:24]\n[property:hosts][punctuation::]\n  [punctuation:-] [variable:&a] [string:阿青]\n[property:note][punctuation::] [operator:|]\n[string:  多行]\n[property:next][punctuation::] [variable:*a]',
    )
    expect(marked(yaml, `tags: [a, true, 3]\n"key": 'it''s'`)).toBe(
      "[property:tags][punctuation::] [punctuation:[][string:a][punctuation:,] [keyword:true][punctuation:,] [number:3][punctuation:]]\n[property:\"key\"][punctuation::] [string:'it''s']",
    )
  })
})

describe('shikiLanguage', () => {
  it('maps scopes to token kinds, innermost first', () => {
    expect(tokenTypeOfScopes(['source.rust', 'comment.line.double-slash.rust'])).toBe('comment')
    expect(
      tokenTypeOfScopes(['source.ts', 'meta.var.expr.ts', 'keyword.operator.assignment.ts']),
    ).toBe('operator')
    expect(
      tokenTypeOfScopes([
        'source.ts',
        'string.quoted.double.ts',
        'punctuation.definition.string.begin.ts',
      ]),
    ).toBe('string')
    expect(tokenTypeOfScopes(['source.ts'])).toBe(null)
  })

  it('reads a Shiki grammar line by line, carrying its state', async () => {
    const highlighter = await createHighlighter({ langs: ['rust'], themes: [] })
    const rust = shikiLanguage(highlighter, 'rust', { comment: { line: '//' } })
    expect(rust.name).toBe('rust')
    expect(rust.comment.line).toBe('//')
    const text = marked(rust, `/* 戴兜\n写的 */ fn main() {\n    let n = 42; // 注释\n}`)
    expect(text).toContain('[comment:/* 戴兜]')
    expect(text).toContain('[comment:写的 */]')
    expect(text).toContain('[keyword:fn]')
    expect(text).toContain('[function:main]')
    expect(text).toContain('[number:42]')
    expect(text).toContain('[comment:// 注释]')
    // the editor's highlighter rereads only what changed, comparing Shiki states
    const doc = CodeText.of(`fn a() {}\n/* x\ny */\nfn b() {}`)
    const lines = new CodeHighlighter(rust, doc)
    expect(lineParts('y */', lines.line(3))[0]).toEqual(['y */', 'comment'])
    expect(lineParts('fn b() {}', lines.line(4))[0]).toEqual(['fn', 'keyword'])
    highlighter.dispose()
  })
})
