import { type CodeLanguage, type CodeTokenType, defineCodeLanguage } from '../language/language'

export interface SqlState {
  /** Inside a `/* … *\/` comment. */
  comment: boolean
  /** The quote of a string or quoted name still open at the line's end. */
  quote: string | null
}

const KEYWORDS = new Set(
  `select from where and or not in is null like ilike between exists as on join inner left right full outer cross natural using
group by order having limit offset fetch first next rows only union all intersect except distinct case when then else end
insert into values update set delete returning create table view index unique primary key foreign references constraint default
check alter add drop column rename to if truncate with recursive begin commit rollback transaction grant revoke
asc desc nulls last over partition window filter cascade materialized temporary temp replace conflict do nothing true false`
    .split(/\s+/)
    .filter(Boolean),
)
const TYPES = new Set(
  `int integer smallint bigint serial bigserial decimal numeric real float double precision char varchar text
boolean bool date time timestamp timestamptz interval json jsonb uuid bytea blob`.split(/\s+/),
)

/** Reads a quoted run up to its closing quote (doubled quotes stay inside); returns whether it closed. */
function readQuoted(
  stream: { next(): string | undefined; eat(c: string): string | undefined },
  quote: string,
) {
  let ch: string | undefined
  while ((ch = stream.next()) !== undefined) {
    if (ch === quote) {
      if (stream.eat(quote)) continue
      return true
    }
    if (ch === '\\' && quote === "'") stream.next()
  }
  return false
}

/** SQL, the parts most dialects share (PostgreSQL, MySQL, SQLite). Keywords in any case. */
export const sql: CodeLanguage<SqlState> = defineCodeLanguage<SqlState>({
  name: 'sql',
  aliases: ['postgres', 'postgresql', 'pgsql', 'mysql', 'sqlite', 'plsql'],
  startState: () => ({ comment: false, quote: null }),
  copyState: (state) => ({ ...state }),
  sameState: (a, b) => a.comment === b.comment && a.quote === b.quote,
  token(stream, state): CodeTokenType | null {
    if (state.comment || stream.match('/*')) {
      state.comment = !stream.skipTo('*/')
      if (state.comment) stream.skipToEnd()
      else stream.pos += 2
      return 'comment'
    }
    if (state.quote) {
      const quote = state.quote
      if (readQuoted(stream, quote)) state.quote = null
      return quote === "'" ? 'string' : 'variable'
    }
    if (stream.eatSpace()) return null
    if (stream.match('--') || stream.match('#')) {
      stream.skipToEnd()
      return 'comment'
    }
    const ch = stream.peek()!
    if (ch === "'" || ch === '"' || ch === '`') {
      stream.next()
      if (!readQuoted(stream, ch)) state.quote = ch
      return ch === "'" ? 'string' : 'variable'
    }
    // E'…', N'…', X'…' strings
    if (stream.match(/^[eEnNxXbB]'/)) {
      if (!readQuoted(stream, "'")) state.quote = "'"
      return 'string'
    }
    if (stream.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)) return 'number'
    // parameters: $1, :name, @name, ?
    if (stream.match(/^(?:\$\d+|[:@][A-Za-z_]\w*|\?)/)) return 'variable'
    const word = stream.match(/^[\p{L}_][\p{L}\p{N}_$]*/u)
    if (word) {
      const lower = word[0].toLowerCase()
      if (stream.string[stream.start - 1] === '.') return 'property'
      if (KEYWORDS.has(lower)) return 'keyword'
      if (TYPES.has(lower)) return 'type'
      if (stream.match(/^\s*\(/, false)) return 'function'
      return 'variable'
    }
    if (stream.match(/^(?:::|<>|!=|<=|>=|\|\||->>?|[-+*/%<>=~^|&])/)) return 'operator'
    if (stream.eat(/[(),;.[\]]/)) return 'punctuation'
    stream.next()
    return null
  },
  comment: { line: '--', block: ['/*', '*/'] },
  brackets: '()[]',
  autoClose: '([\'"`',
})
