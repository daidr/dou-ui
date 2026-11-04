<script setup>
const content = `部署前请确认以下事项：

\`\`\`tip
预览环境会在分支合并 30 天后自动清理。
\`\`\`

\`\`\`sh
bun run build
\`\`\`

![构建流程](https://images.example.com/pipeline.png)`
</script>

<template>
  <DouMarkdown :content="content">
    <template #code="{ code, lang }">
      <DouAlert v-if="lang === 'tip'" tone="primary">{{ code }}</DouAlert>
      <DouCodeBlock v-else :code="code" :lang="lang" />
    </template>
    <template #image="{ alt }">
      <div class="placeholder">{{ alt }}</div>
    </template>
  </DouMarkdown>
</template>

<style scoped>
.placeholder {
  display: grid;
  height: 96px;
  place-items: center;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: var(--dou-radius-container);
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
