import { useData } from 'vitepress'
import type { Theme } from 'vitepress'
import { watchEffect } from 'vue'
import DouUI from 'dou-ui'
import 'dou-ui/style.css'
import './style.css'
import Layout from './Layout.vue'
import DocCode from './components/DocCode.vue'
import DocIconGallery from './components/DocIconGallery.vue'
import TokenSwatches from './components/TokenSwatches.vue'

export default {
  Layout,
  enhanceApp({ app }) {
    app.use(DouUI)
    // Every fenced code block is wrapped in DocCode (see the markdown config).
    app.component('DocCode', DocCode)
    app.component('TokenSwatches', TokenSwatches)
    app.component('DocIconGallery', DocIconGallery)
  },
  setup() {
    // The head script sets the theme before the first paint; this keeps it in
    // step with the switch afterwards.
    const { isDark } = useData()
    watchEffect(() => {
      if (typeof document === 'undefined') return
      document.documentElement.dataset.douTheme = isDark.value ? 'dark' : 'light'
    })
  },
} satisfies Theme
