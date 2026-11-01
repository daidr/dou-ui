<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { computed } from 'vue'
import { shortcuts } from './shortcuts'

const { props, editing } = useDashboardWidget()
const shown = computed(() => shortcuts.filter((item) => (props.value.ids ?? []).includes(item.id)))
</script>

<template>
  <div class="shortcuts">
    <a
      v-for="item in shown"
      :key="item.id"
      class="shortcuts__item"
      href="#"
      :tabindex="editing ? -1 : undefined"
      @click.prevent
    >
      <span class="shortcuts__tile"><component :is="item.icon" class="shortcuts__icon" /></span>
      <span>{{ item.label }}</span>
    </a>
  </div>
</template>

<style scoped>
.shortcuts {
  display: flex;
  gap: 8px;
  /* a narrow widget scrolls the row sideways instead of cutting off a second row */
  overflow-x: auto;
  scrollbar-width: none;
}
.shortcuts__item {
  flex: 1 0 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  border-radius: var(--dou-radius-control);
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
  text-decoration: none;
}
.shortcuts__item:hover {
  background: color-mix(in oklab, var(--dou-color-text) 6%, transparent);
}
.shortcuts__item:focus-visible {
  outline: 2px solid var(--dou-color-focus);
  outline-offset: -2px;
}
.shortcuts__tile {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  background: var(--dou-color-bg-surface);
}
.shortcuts__icon {
  width: 20px;
  height: 20px;
  color: var(--dou-color-text-secondary);
}
</style>
