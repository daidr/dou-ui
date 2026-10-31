<script setup>
import { css, DouCodeEditor, json, markdown, typescript, vue } from '@dou-ui/code'
import { DouSegmentedControl, DouSpace } from 'dou-ui'
import { computed, ref } from 'vue'

const samples = {
  vue: {
    language: vue,
    code: `<script setup lang="ts">
import { ref } from 'vue'

const cups = ref(2)
${'<'}/script>

<template>
  <button :class="{ on: cups > 0 }" @click="cups++">
    戴兜点了 {{ cups }} 杯
  </button>
</template>

<style scoped>
.on {
  color: #3f56b5;
}
</style>
`,
  },
  typescript: {
    language: typescript,
    code: `type Sugar = '无糖' | '半糖' | '全糖'

/** 同一种甜度一共几杯 */
export function cupsOf(orders: { sugar: Sugar; cups: number }[], sugar: Sugar) {
  return orders
    .filter((order) => order.sugar === sugar)
    .reduce((sum, order) => sum + order.cups, 0)
}
`,
  },
  css: {
    language: css,
    code: `.menu > li:hover {
  color: var(--dou-color-text);
  padding: 4px 12px;
  background: rgb(0 0 0 / 0.04) !important;
}

@media (min-width: 640px) {
  .menu { display: flex; }
}
`,
  },
  json: {
    language: json,
    code: `{
  "shop": "上海一店",
  "open": true,
  "seats": 24,
  "menu": ["奶茶", "果茶", null]
}
`,
  },
  markdown: {
    language: markdown,
    code: `# 今日菜单

- **奶茶**：半糖、*少冰*
- 果茶，见 [价目表](./price.md)

\`\`\`
每人限两杯
\`\`\`
`,
  },
}

const options = [
  { label: 'Vue', value: 'vue' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Markdown', value: 'markdown' },
]
const current = ref('vue')
const codes = ref(Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, v.code])))
const language = computed(() => samples[current.value].language)
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouSegmentedControl v-model="current" :options="options" size="sm" />
    <DouCodeEditor
      :key="current"
      v-model="codes[current]"
      :language="language"
      aria-label="语言示例"
    />
  </DouSpace>
</template>
