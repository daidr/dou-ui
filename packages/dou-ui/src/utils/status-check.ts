import { watchEffect } from 'vue'

// one warning per component and value for the whole page, so a long list doesn't flood the console
const warned = new Set<string>()

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
      const key = `${component}:${status}`
      if (warned.has(key)) continue
      warned.add(key)
      const hint = renamed[status] ? ` Use \`${renamed[status]}\`.` : ''
      console.warn(
        `[dou-ui] ${component}: unknown status \`${status}\`, expected one of ${known.map((k) => `\`${k}\``).join(', ')}.${hint}`,
      )
    }
  })
}
