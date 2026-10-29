<script setup>
const rows = Array.from({ length: 30 }, (_, i) => `第 ${i + 1} 条通知 · 部署 #${1024 + i} 已完成`)
</script>

<template>
  <DouScrollbar
    :height="200"
    style="
      width: 320px;
      border: 1px solid var(--dou-color-border-subtle);
      border-radius: var(--dou-radius-control);
    "
  >
    <div style="padding: 8px 12px">
      <DouText
        v-for="row in rows"
        :key="row"
        as="p"
        size="sm"
        variant="secondary"
        style="margin: 6px 0"
      >
        {{ row }}
      </DouText>
    </div>
  </DouScrollbar>
</template>
