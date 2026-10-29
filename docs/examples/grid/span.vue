<template>
  <DouGrid :cols="12" gap="sm">
    <DouGridItem span="full"><div class="cell">full</div></DouGridItem>
    <DouGridItem :span="8"><div class="cell">8</div></DouGridItem>
    <DouGridItem :span="4"><div class="cell">4</div></DouGridItem>
    <DouGridItem :span="6" :start="4"><div class="cell">start 4 · span 6</div></DouGridItem>
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
