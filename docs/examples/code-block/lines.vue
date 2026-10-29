<script setup>
import { codeToHtml } from 'shiki'
import { transformerNotationDiff } from '@shikijs/transformers'

const highlight = (code, lang) =>
  codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    transformers: [transformerNotationDiff({ matchAlgorithm: 'v3' })],
  })

const code = `<template>
  <DouForm :model="profile" @submit="save">
    <DouFormItem label="名称" prop="name" required>
      <DouInput v-model="profile.name" />
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit">保存</DouButton>
    </DouFormItem>
  </DouForm>
</template>`

const diff = `export default {
  defaults: {
    DouButton: { variant: 'outline' }, // [!code --]
    DouButton: { variant: 'soft' }, // [!code ++]
  },
}`
</script>

<template>
  <DouCodeBlock
    :code="code"
    lang="vue"
    filename="App.vue"
    :highlight="highlight"
    line-numbers
    highlight-lines="3-5"
  />
  <DouCodeBlock :code="diff" lang="ts" filename="dou.config.ts" :highlight="highlight" />
</template>
