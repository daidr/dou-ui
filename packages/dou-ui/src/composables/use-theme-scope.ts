import { ref } from 'vue'

/**
 * A layer teleported to `<body>` leaves the subtree that set its theme.
 * Read the theme in effect where the layer is declared so it can be set
 * again on the layer itself.
 */
export function useThemeScope(anchor: () => Node | null | undefined) {
  const theme = ref<string>()
  function sync() {
    const node = anchor()
    const element = node instanceof Element ? node : node?.parentElement
    theme.value = element?.closest<HTMLElement>('[data-dou-theme]')?.dataset.douTheme
  }
  return { theme, sync }
}
