<template>
  <DouGrid :min-item-width="160" gap="md">
    <div v-for="i in 7" :key="i" class="cell">{{ i }}</div>
  </DouGrid>
</template>

<style>
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: 6px;
  color: var(--dou-color-text-tertiary);
  font-size: 13px;
}
</style>
