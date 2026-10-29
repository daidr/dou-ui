<script setup>
const rows = Array.from({ length: 10000 }, (_, index) => ({
  id: index,
  name: `deploy-${String(index).padStart(5, '0')}`,
  region: ['上海', '新加坡', '东京', '法兰克福'][index % 4],
}))
</script>

<template>
  <DouCard padding="none">
    <DouVirtualList :items="rows" :item-size="36" item-key="id" :height="288">
      <template #default="{ item, index }">
        <div class="vl-row">
          <DouText mono>{{ item.name }}</DouText>
          <DouText variant="tertiary" size="sm">{{ item.region }} · #{{ index }}</DouText>
        </div>
      </template>
    </DouVirtualList>
  </DouCard>
</template>

<style>
.vl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  box-sizing: border-box;
}
.vl-row--target {
  background: color-mix(in oklab, var(--dou-color-text) 6%, transparent);
}
</style>
