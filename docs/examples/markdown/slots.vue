<script setup>
const content = `发布前请先看[发布流程](/guide/release)，构建命令如下：

\`\`\`sh
bun run build
\`\`\`

上线后在[监控面板](https://status.example.com)确认没有报错。

![构建流程](https://images.example.com/pipeline.png)`
</script>

<template>
  <DouMarkdown :content="content">
    <!-- external: a full address, which opens in a new window -->
    <template #link="{ href, external, children }">
      <DouLink :href="href" :external="external" tone="primary">
        <component :is="children" />
      </DouLink>
    </template>
    <!-- only `sh` blocks; pass `streaming` on so that only whole lines are highlighted -->
    <template #code-sh="{ code, streaming }">
      <DouCodeBlock :code="code" lang="sh" filename="终端" :streaming="streaming" />
    </template>
    <template #image="{ alt }">
      <span class="placeholder">{{ alt }}</span>
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
