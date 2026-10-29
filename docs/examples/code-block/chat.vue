<script setup>
import { codeToHtml } from 'shiki'

const highlight = (code, lang) =>
  codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })

const parts = [
  { type: 'text', text: '可以用 Intl.NumberFormat 按地区格式化金额：' },
  {
    type: 'code',
    lang: 'ts',
    code: `const price = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
})

price.format(1288) // "¥1,288.00"`,
  },
  { type: 'text', text: '换成其他地区时，只需要修改第一个参数。' },
]
</script>

<template>
  <DouChatMessage :parts="parts">
    <template #part="{ part }">
      <DouCodeBlock
        v-if="part.type === 'code'"
        :code="part.code"
        :lang="part.lang"
        :highlight="highlight"
      />
    </template>
  </DouChatMessage>
</template>
