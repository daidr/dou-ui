import { defineCodeLanguage, type CodeLanguage, type CodeTokenType } from '@dou-ui/code'

export interface SheetFormulaState {
  /** A "text" value still open at the line's end. */
  quote: boolean
}

const SHEET = String.raw`(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!`
const CELL = String.raw`\$?[A-Za-z]{1,3}\$?\d+`
const REF = new RegExp(
  String.raw`^(?:${SHEET})?(?:${CELL}(?::${CELL})?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)(?![\p{L}\p{N}_(])`,
  'u',
)
const ERROR = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!)/i
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?%?/
const NAME = /^[\p{L}_][\p{L}\p{N}_.]*/u

/**
 * Spreadsheet formulas, as the sheet writes them: `=SUM(A1:B2, "text")`.
 * Function names, references, "text", numbers, error values and
 * `TRUE` / `FALSE` each have their color. For the text after the `=`, or
 * with it; a value typed into a cell isn't a formula, so leave the
 * language out for it.
 */
export const sheetFormula: CodeLanguage<SheetFormulaState> = defineCodeLanguage<SheetFormulaState>({
  name: 'sheet-formula',
  startState: () => ({ quote: false }),
  copyState: (state) => ({ ...state }),
  sameState: (a, b) => a.quote === b.quote,
  token(stream, state): CodeTokenType | null {
    if (state.quote || stream.peek() === '"') {
      if (!state.quote) stream.next()
      state.quote = true
      while (!stream.eol()) {
        if (stream.next() === '"') {
          if (stream.eat('"')) continue
          state.quote = false
          break
        }
      }
      return 'string'
    }
    if (stream.eatSpace()) return null
    if (stream.match(ERROR)) return 'invalid'
    if (stream.match(REF)) return 'variable'
    if (stream.match(NUMBER)) return 'number'
    const name = stream.match(NAME)
    if (name) {
      if (stream.match(/^\s*\(/, false)) return 'function'
      return /^(?:TRUE|FALSE)$/i.test(name[0]) ? 'keyword' : 'variable'
    }
    if (stream.match(/^(?:<>|<=|>=|[-+*/^&=<>%])/)) return 'operator'
    if (stream.eat(/[(),;{}]/)) return 'punctuation'
    stream.next()
    return null
  },
  brackets: '(){}',
  autoClose: '("',
})
