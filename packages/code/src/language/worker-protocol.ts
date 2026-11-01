import type { CodeLanguage } from './language'

/*
 * Messages between the editor and a highlighting worker, and how states
 * cross over: languages inside a state (the script in an HTML file) go by
 * name, everything else as plain data.
 */

/** A change as sent: `[from, to, insert]`. */
export type WireChange = [from: number, to: number, insert: string]

export type ToWorker =
  /** `nested`: the names of the languages it may hold, which the worker's language must hold too. */
  | { t: 'open'; id: number; language: string; nested: string[]; tabSize: number }
  /** The text, in pieces of whole lines; `done` on the last. */
  | { t: 'text'; id: number; lines: string[]; done: boolean }
  | { t: 'change'; id: number; changes: WireChange[]; length: number }
  | { t: 'read'; id: number; from: number; until: number }
  | { t: 'close'; id: number }

export type FromWorker =
  | { t: 'states'; id: number; version: number; points: Array<[line: number, state: unknown]> }
  /** The worker hasn't the language named `missing`, or (without it) can't send its states. */
  | { t: 'unsupported'; id: number; missing?: string }

const LANGUAGE = '$codeLanguage'

const isLanguage = (value: object): value is CodeLanguage =>
  typeof (value as CodeLanguage).token === 'function' &&
  typeof (value as CodeLanguage).startState === 'function'

/** A state as plain data, its languages replaced by their names. */
export function encodeState(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) return value.map(encodeState)
  if (isLanguage(value)) return { [LANGUAGE]: value.name }
  const out: Record<string, unknown> = {}
  for (const key in value) out[key] = encodeState((value as Record<string, unknown>)[key])
  return out
}

/** A state back from plain data; `undefined` when it names a language `find` doesn't know. */
export function decodeState(
  value: unknown,
  find: (name: string) => CodeLanguage | undefined,
): unknown {
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) {
      const decoded = decodeState(item, find)
      if (decoded === undefined && item !== undefined) return undefined
      out.push(decoded)
    }
    return out
  }
  const record = value as Record<string, unknown>
  if (typeof record[LANGUAGE] === 'string') return find(record[LANGUAGE])
  const out: Record<string, unknown> = {}
  for (const key in record) {
    const decoded = decodeState(record[key], find)
    if (decoded === undefined && record[key] !== undefined) return undefined
    out[key] = decoded
  }
  return out
}

/** A language and every language it may hold, by name. */
export function languagesIn(language: CodeLanguage): Map<string, CodeLanguage> {
  const found = new Map<string, CodeLanguage>()
  const visit = (item: CodeLanguage) => {
    if (found.has(item.name)) return
    found.set(item.name, item)
    for (const inner of item.nested ?? []) visit(inner)
  }
  visit(language)
  return found
}
