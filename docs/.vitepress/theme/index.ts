import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import type { Theme } from 'vitepress'
import { watchEffect } from 'vue'
import DouUI from 'dou-ui'
import 'dou-ui/style.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(DouUI)
  },
  setup() {
    // Keep DouUI's theme in sync with the docs site's dark mode switch.
    const { isDark } = useData()
    watchEffect(() => {
      if (typeof document === 'undefined') return
      document.documentElement.dataset.douTheme = isDark.value ? 'dark' : 'light'
    })
  },
} satisfies Theme
