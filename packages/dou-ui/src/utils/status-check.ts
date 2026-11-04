import { watchEffect } from 'vue'

// one warning per component and value for the whole page, so a long list doesn't flood the console
const warned = new Set<string>()

/** Warn once per page for `key`. Call only while developing. */
export function warnOnce(key: string, message: string) {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(message)
}

/**
 * While developing, warn once about a `status` the component doesn't know,
 * e.g. an old name in JSON from a server, where types can't catch it.
 * `renamed` maps old names to the new ones to suggest.
 */
export function useStatusCheck(
  component: string,
  statuses: () => readonly (string | undefined)[],
  known: readonly string[],
  renamed: Record<string, string> = {},
) {
  // The app's bundler replaces this, as for Vue's own warnings.
  if (process.env.NODE_ENV === 'production') return
  watchEffect(() => {
    for (const status of statuses()) {
      if (status === undefined || known.includes(status)) continue
      const hint = renamed[status] ? ` Use \`${renamed[status]}\`.` : ''
      warnOnce(
        `${component}:${status}`,
        `[dou-ui] ${component}: unknown status \`${status}\`, expected one of ${known.map((k) => `\`${k}\``).join(', ')}.${hint}`,
      )
    }
  })
}
