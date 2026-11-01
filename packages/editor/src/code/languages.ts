import {
  css,
  html,
  javascript,
  json,
  jsx,
  markdown,
  python,
  scss,
  shell,
  sql,
  tsx,
  typescript,
  vue,
  yaml,
  type CodeLanguage,
} from '@dou-ui/code'
import type { CodeEditorLanguage } from './types'

const LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  html: 'HTML',
  vue: 'Vue',
  markdown: 'Markdown',
  python: 'Python',
  shell: 'Shell',
  sql: 'SQL',
  yaml: 'YAML',
}

/** The built-in languages of `@dou-ui/code`, as the picker lists them. */
export const codeEditorLanguages: CodeEditorLanguage[] = [
  javascript,
  typescript,
  jsx,
  tsx,
  html,
  vue,
  css,
  scss,
  json,
  markdown,
  python,
  shell,
  sql,
  yaml,
].map((language) => ({
  language,
  label: LABELS[language.name] ?? language.name,
}))

export const toEntry = (item: CodeLanguage | CodeEditorLanguage): CodeEditorLanguage =>
  'language' in item ? item : { language: item, label: LABELS[item.name] ?? item.name }

/** The picker entry for a block's `language` prop: by name, then by alias. */
export function findCodeLanguage(
  languages: readonly CodeEditorLanguage[],
  value: string,
): CodeEditorLanguage | null {
  const name = value.trim().toLowerCase()
  if (!name) return null
  return (
    languages.find((entry) => entry.language.name === name) ??
    languages.find((entry) => entry.language.aliases.includes(name)) ??
    null
  )
}
