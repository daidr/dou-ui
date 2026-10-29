<script setup>
import { codeToHtml } from 'shiki'

const highlight = (code, lang) =>
  codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })

const code = `import { createApp } from 'vue'
import DouUI from 'dou-ui'
import 'dou-ui/style.css'
import App from './App.vue'

createApp(App).use(DouUI).mount('#app')`
</script>

<template>
  <DouCodeBlock :code="code" lang="ts" filename="main.ts" :highlight="highlight" />
  <DouCodeBlock code="bun add dou-ui" lang="sh" :highlight="highlight" />
</template>
