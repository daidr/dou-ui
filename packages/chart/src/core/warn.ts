const warned = new Set<string>()
/** A warning in development, once per kind of mistake. */
export function warnOnce(key: string, text: string) {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production' || warned.has(key)) return
  warned.add(key)
  console.warn(`[@dou-ui/chart] ${text}`)
}
