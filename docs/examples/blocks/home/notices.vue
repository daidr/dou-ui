<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouTag } from 'dou-ui'

const { props } = useDashboardWidget()
</script>

<template>
  <ul class="notices">
    <li v-for="item in props.items ?? []" :key="item.title" class="notices__item">
      <DouTag v-if="item.tag" size="sm" :tone="item.tone">{{ item.tag }}</DouTag>
      <span class="notices__title">{{ item.title }}</span>
      <span class="notices__date">{{ item.date }}</span>
    </li>
  </ul>
</template>

<style scoped>
.notices {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.notices__item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: var(--dou-font-size-sm);
}
.notices__title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--dou-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notices__date {
  flex: none;
  color: var(--dou-color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
