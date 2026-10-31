<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { computed } from 'vue'

const { props, data, setFilter, ownFilters } = useDashboardWidget()

const max = computed(() => Math.max(1, ...(data.value ?? []).map((row) => row.value)))
// 点一行，按它筛选其他格子；再点一次取消。这个格子自己仍然显示全部
// 筛选的值是代码，label 给出显示在标题栏和筛选栏里的名字
const picked = computed(() => ownFilters.value[props.value.filterKey])
function pick(row) {
  setFilter(props.value.filterKey, picked.value === row.code ? undefined : row.code, {
    label: row.name,
  })
}
</script>

<template>
  <ul class="bars">
    <li v-for="row in data ?? []" :key="row.code">
      <button
        type="button"
        :class="[
          'bar',
          picked === row.code && 'is-picked',
          picked && picked !== row.code && 'is-dim',
        ]"
        :aria-pressed="picked === row.code"
        @click="pick(row)"
      >
        <span class="name">{{ row.name }}</span>
        <span class="track"
          ><span class="fill" :style="{ width: `${(row.value / max) * 100}%` }"
        /></span>
        <span class="value">{{ (row.value / 10000).toFixed(1) }} 万</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bars li {
  margin: 0;
}
.bar {
  display: grid;
  grid-template-columns: 3em 1fr 4.5em;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 28px;
  padding: 0 4px;
  border: 0;
  border-radius: var(--dou-radius-sm);
  background: none;
  color: var(--dou-color-text);
  font: inherit;
  font-size: var(--dou-font-size-sm);
  text-align: left;
  cursor: pointer;
}
.bar:hover {
  background: var(--dou-color-bg-muted);
}
.bar:focus-visible {
  outline: 2px solid var(--dou-color-focus);
  outline-offset: -2px;
}
.bar.is-dim {
  color: var(--dou-color-text-tertiary);
}
.track {
  height: 8px;
  border-radius: 4px;
  background: var(--dou-color-bg-muted);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--dou-color-text-tertiary);
}
.is-picked .fill {
  background: var(--dou-color-text);
}
.is-dim .fill {
  opacity: 0.5;
}
.value {
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
