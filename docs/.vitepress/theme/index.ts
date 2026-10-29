import type { Theme } from 'vitepress'
import DouUI, { useColorMode } from 'dou-ui'
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
    // The head script applies the mode before the first paint; this keeps
    // it in step with the color mode button and the system afterwards.
    useColorMode()
  },
} satisfies Theme
