<script setup>
import { ref } from 'vue'
import { codeToHtml } from 'shiki'

const highlight = (code, lang) =>
  codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })

const wrap = ref(false)
const code = `{
  "name": "dou-ui-starter",
  "private": true,
  "type": "module",
  "description": "一个使用 DouUI 的起步项目，包含路由、状态管理和按需引入组件的配置，可以直接作为新项目的起点。",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "dou-ui": "latest",
    "@dou-ui/icons": "latest",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  }
}`
</script>

<template>
  <DouSwitch v-model="wrap">自动换行</DouSwitch>
  <DouCodeBlock
    :code="code"
    lang="json"
    filename="package.json"
    :highlight="highlight"
    :wrap="wrap"
    :max-lines="8"
    line-numbers
  />
</template>
