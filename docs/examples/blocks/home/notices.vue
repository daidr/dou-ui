<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouTag, DouTooltip } from 'dou-ui'

const { props } = useDashboardWidget()
</script>

<template>
  <ul class="notices">
    <li v-for="item in props.items ?? []" :key="item.title" class="notices__item">
      <DouTag v-if="item.tag" size="sm" :tone="item.tone">{{ item.tag }}</DouTag>
      <!-- 标题最多两行，放不下时悬停或聚焦显示全文 -->
      <DouTooltip :content="item.title">
        <a class="notices__title" href="#" @click.prevent>{{ item.title }}</a>
      </DouTooltip>
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
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  font-size: var(--dou-font-size-sm);
}
.notices__title {
  flex: 1 1 auto;
  min-width: 0;
  display: -webkit-box;
  overflow: hidden;
  color: var(--dou-color-text);
  line-height: var(--dou-font-line-height);
  text-decoration: none;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.notices__title:hover {
  text-decoration: underline;
}
.notices__title:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--dou-color-focus);
}
.notices__date {
  flex: none;
  line-height: var(--dou-font-line-height);
  color: var(--dou-color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
