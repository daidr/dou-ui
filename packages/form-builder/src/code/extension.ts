import { defineCodeExtension } from '@dou-ui/code'
import type {
  CodeCompletion,
  CodeDiagnostic,
  CodeExtension,
  CodeSignatureResult,
} from '@dou-ui/code'
import { builtinFunctions, checkExpression } from '../core/expression'
import type { ExpressionProblem } from '../core/expression'
import { referenceSource } from '../builder/condition'

/** A path an expression can read, with what to show beside it. */
export interface ExpressionName {
  path: string
  label?: string
}

/** What a function takes and does, for hover text and parameter hints. */
export interface ExpressionFunctionInfo {
  /** As it is called, e.g. `round(value, digits?)`. */
  signature: string
  info?: string
}

type Getter<T> = T | (() => T)
const read = <T>(value: Getter<T>): T =>
  typeof value === 'function' ? (value as () => T)() : value

export interface ExpressionCodeOptions {
  /** The paths `values` can read. */
  names?: Getter<readonly ExpressionName[]>
  /** The paths `item` can read; left out where there is no list item. */
  itemNames?: Getter<readonly ExpressionName[] | undefined>
  /** Whether `value` (the field's own value) can be read, as in a check. */
  readsValue?: Getter<boolean>
  /** Functions besides the built-in ones. */
  functions?: Getter<readonly string[]>
  /** What each function takes and does, by name. */
  functionInfo?: Getter<Readonly<Record<string, ExpressionFunctionInfo>>>
  /** Shown beside `values`, `item`, `value` and the keywords in completions. */
  labels?: Getter<{ values?: string; item?: string; value?: string; keyword?: string }>
  /** The words for a problem; the English description by default. */
  problemMessage?: (problem: ExpressionProblem) => string
  /** Finds problems as the expression is typed. On by default. */
  lint?: boolean
}

const KEYWORDS = ['true', 'false', 'null', 'in']

/** Whether `text` ends inside quoted text. */
function inString(text: string) {
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = ''
    } else if (char === "'" || char === '"') quote = char
  }
  return !!quote
}

/** The parameters of `signature` as `[from, to]` in it. */
function paramsOf(signature: string): Array<[number, number]> {
  const open = signature.indexOf('(')
  const close = signature.lastIndexOf(')')
  if (open < 0 || close <= open + 1) return []
  const out: Array<[number, number]> = []
  let from = open + 1
  for (let i = from; i <= close; i++) {
    if (i === close || signature[i] === ',') {
      let a = from
      while (signature[a] === ' ') a++
      out.push([a, i])
      from = i + 1
    }
  }
  return out
}

/** The call around `pos` in `text`: its name and which argument the cursor is in. */
function callAt(text: string, pos: number) {
  let depth = 0
  let commas = 0
  let quote = ''
  // Strings first: brackets and commas inside them don't count.
  const plain = text.slice(0, pos).split('')
  for (let i = 0; i < plain.length; i++) {
    const char = plain[i]!
    if (quote) {
      if (char === '\\') {
        plain[i] = ' '
        if (i + 1 < plain.length) plain[++i] = ' '
        continue
      }
      if (char === quote) quote = ''
      plain[i] = ' '
    } else if (char === "'" || char === '"') {
      quote = char
      plain[i] = ' '
    }
  }
  for (let i = plain.length - 1; i >= 0; i--) {
    const char = plain[i]
    if (char === ')' || char === ']') depth++
    else if (char === '[') {
      if (depth-- === 0) return null
    } else if (char === ',' && depth === 0) commas++
    else if (char === '(') {
      if (depth-- > 0) continue
      const name = /([A-Za-z_$À-￿][\w$À-￿]*)\s*$/.exec(plain.slice(0, i).join(''))
      return name ? { name: name[1]!, arg: commas } : null
    }
  }
  return null
}

/**
 * Completions, hover text, parameter hints and problems for form
 * expressions in a `DouCodeEditor` or `DouCodeInput`: field paths after
 * `values.` and `item.`, functions as snippets, and the problems of
 * `checkExpression` underlined where they are.
 */
export function expressionCodeExtension(options: ExpressionCodeOptions = {}): CodeExtension {
  const functionNames = () => [
    ...new Set([...Object.keys(builtinFunctions), ...read(options.functions ?? [])]),
  ]
  const infoOf = (name: string) => read(options.functionInfo ?? {})[name]

  return defineCodeExtension({
    name: 'form-expression',
    completionTriggers: ['.'],
    completion({ pos, word }, { doc }) {
      const line = doc.lineAt(pos)
      const before = line.text.slice(0, pos - line.from)
      if (inString(before)) return null
      const labels = read(options.labels ?? {})

      // A path after `values.` or `item.`, dots and all.
      const path = /\b(values|item)\.([\w$.À-￿]*)$/.exec(before)
      if (path) {
        const root = path[1] as 'values' | 'item'
        const list = root === 'values' ? read(options.names ?? []) : read(options.itemNames)
        if (!list) return null
        const typed = path[2]!
        const from = pos - typed.length
        return {
          from,
          options: list
            // Paths written with brackets are left to type by hand.
            .filter(({ path: name }) => referenceSource(root, name) === `${root}.${name}`)
            .map(({ path: name, label }) => ({
              label: name,
              kind: 'property' as const,
              detail: label,
            })),
        }
      }
      // After any other dot there is nothing to offer.
      if (before.slice(0, before.length - word.text.length).endsWith('.')) return null

      const entries: CodeCompletion[] = [
        { label: 'values', kind: 'variable', detail: labels.values, boost: 2 },
      ]
      if (read(options.itemNames))
        entries.push({ label: 'item', kind: 'variable', detail: labels.item, boost: 2 })
      if (read(options.readsValue ?? false))
        entries.push({ label: 'value', kind: 'variable', detail: labels.value, boost: 2 })
      for (const name of functionNames()) {
        const info = infoOf(name)
        // The parameters to fill in: the required ones; `...rest` once.
        const required = (info ? paramsOf(info.signature) : [])
          .map(([a, b]) => info!.signature.slice(a, b))
          .filter((param) => !param.endsWith('?'))
        const fields = required
          .map((param, i) => `\${${i + 1}:${param.replace(/^\.\.\./, '')}}`)
          .join(', ')
        entries.push({
          label: name,
          kind: 'function',
          detail: info ? info.signature.slice(name.length) : '()',
          info: info?.info,
          snippet: required.length ? `${name}(${fields})` : `${name}($0)`,
        })
      }
      for (const keyword of KEYWORDS)
        entries.push({ label: keyword, kind: 'keyword', detail: labels.keyword, boost: -1 })
      return { from: word.from, options: entries }
    },

    hover({ pos }, { doc }) {
      const line = doc.lineAt(pos)
      const col = pos - line.from
      for (const match of line.text.matchAll(/[A-Za-z_$À-￿][\w$À-￿]*/g)) {
        const from = match.index!
        const to = from + match[0].length
        if (col < from || col > to) continue
        const info = infoOf(match[0])
        if (!info || !/^\s*\(/.test(line.text.slice(to))) return null
        return {
          from: line.from + from,
          to: line.from + to,
          content: info.info ? `${info.signature}\n${info.info}` : info.signature,
        }
      }
      return null
    },

    signature({ pos }, { doc }): CodeSignatureResult | null {
      const line = doc.lineAt(pos)
      const call = callAt(line.text, pos - line.from)
      const info = call && infoOf(call.name)
      if (!call || !info) return null
      const params = paramsOf(info.signature)
      // `...numbers` takes the rest.
      const last = params.length - 1
      const rest = last >= 0 && info.signature.slice(params[last]![0]).startsWith('...')
      const active = rest ? Math.min(call.arg, last) : call.arg
      if (active > last) return null
      return { label: info.signature, params, active, info: info.info }
    },

    lint:
      options.lint === false
        ? undefined
        : ({ doc }) => {
            const source = doc.toString()
            if (!source.trim()) return []
            const itemNames = read(options.itemNames)
            return checkExpression(source, {
              fields: read(options.names ?? []).map((name) => name.path),
              itemFields: itemNames ? itemNames.map((name) => name.path) : [],
              functions: read(options.functions ?? []),
            }).map((problem): CodeDiagnostic => ({
              from: problem.start,
              to: Math.max(problem.end, problem.start),
              severity: 'error',
              message: options.problemMessage?.(problem) ?? problem.message,
            }))
          },
  })
}
