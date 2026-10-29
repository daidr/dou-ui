<script setup>
const wide = Array.from({ length: 12 }, (_, i) => `列 ${i + 1}`)
</script>

<template>
  <DouScrollbar
    always
    style="
      width: 360px;
      border: 1px solid var(--dou-color-border-subtle);
      border-radius: var(--dou-radius-control);
    "
  >
    <div style="display: flex; gap: 8px; padding: 12px 12px 18px">
      <DouTag v-for="item in wide" :key="item" size="lg">{{ item }}</DouTag>
    </div>
  </DouScrollbar>
</template>
