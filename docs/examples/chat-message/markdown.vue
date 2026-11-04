<script setup>
const parts = [
  { type: 'reasoning', text: '先查**周六天气**，再找骑行路线。', duration: 3 },
  {
    type: 'sources',
    items: [{ title: '上海市气象局', url: 'https://weather.example.com' }],
  },
  {
    type: 'text',
    text: `周六上海多云转小雨[1]。

:::tip 出行建议
上午去滨江骑行，下午改去室内。
:::

\`\`\`route
外滩 → 南浦大桥 → 前滩
\`\`\``,
  },
]
</script>

<template>
  <DouChatMessage markdown :parts="parts">
    <template #markdown-code-route="{ code }">
      <div class="route">{{ code }}</div>
    </template>
  </DouChatMessage>
</template>

<style scoped>
.route {
  padding: 8px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  font-size: var(--dou-font-size-sm);
}
</style>
