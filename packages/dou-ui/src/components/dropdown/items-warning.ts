import { watchEffect } from 'vue'

/** Says once, while developing, that `items` does nothing next to a `menu` slot. */
export function useItemsWarning(component: string, both: () => boolean) {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production') return
  let warned = false
  watchEffect(() => {
    if (warned || !both()) return
    warned = true
    console.warn(
      `[dou-ui] ${component} got both \`items\` and a \`menu\` slot; the slot is shown and \`items\` is ignored.`,
    )
  })
}
