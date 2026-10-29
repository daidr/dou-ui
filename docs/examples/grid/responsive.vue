<template>
  <DouGrid :cols="{ base: 1, sm: 2, lg: 4 }" gap="md">
    <DouGridItem :span="{ base: 1, lg: 2 }"><div class="cell">lg 起占两列</div></DouGridItem>
    <div v-for="i in 5" :key="i" class="cell">{{ i }}</div>
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
