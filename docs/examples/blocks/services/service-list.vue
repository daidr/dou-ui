<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouBadge } from 'dou-ui'
import { computed } from 'vue'

const { data, setFilter, ownFilters, editing } = useDashboardWidget()
const picked = computed(() => ownFilters.value.service)
const statusText = { success: '正常', warning: '偏慢', danger: '异常' }

// 点一个服务，其他格子只看这个服务；再点一次取消
function toggle(service) {
  setFilter('service', picked.value === service.id ? undefined : service.id, {
    label: service.name,
  })
}
</script>

<template>
  <div class="services-widget">
    <div class="services__head" aria-hidden="true">
      <span />
      <span>服务</span>
      <span class="is-rps">请求量</span>
      <span>P95</span>
      <span>错误率</span>
    </div>
    <ul class="services">
      <li v-for="service in data ?? []" :key="service.id">
        <button
          type="button"
          class="service"
          :class="{ 'is-picked': picked === service.id }"
          :aria-pressed="picked === service.id"
          :disabled="editing"
          @click="toggle(service)"
        >
          <DouBadge dot :tone="service.status" :label="statusText[service.status]" />
          <span class="service__name">{{ service.name }}</span>
          <span class="service__metric is-rps">{{ service.rps.toLocaleString() }}/s</span>
          <span class="service__metric">{{ service.p95 }} ms</span>
          <span class="service__metric" :class="{ 'is-high': service.errorRate >= 2 }">
            {{ service.errorRate.toFixed(2) }}%
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.services-widget {
  container-type: inline-size;
}
.services__head,
.service {
  display: grid;
  grid-template-columns: 8px minmax(3em, 1fr) 4.5em 4.5em 4.5em;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
}
.services__head {
  margin-bottom: 4px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
.services__head span:nth-child(n + 3) {
  text-align: right;
}
.services {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.service {
  width: 100%;
  min-height: 32px;
  border: 0;
  border-radius: var(--dou-radius-control);
  background: transparent;
  color: var(--dou-color-text);
  font: inherit;
  font-size: var(--dou-font-size-sm);
  text-align: left;
  cursor: pointer;
}
.service:hover:not(:disabled) {
  background: color-mix(in oklab, var(--dou-color-text) 6%, transparent);
}
.service:focus-visible {
  outline: 2px solid var(--dou-color-focus);
  outline-offset: -2px;
}
.service:disabled {
  cursor: default;
}
.service.is-picked {
  background: color-mix(in oklab, var(--dou-color-text) 10%, transparent);
  font-weight: var(--dou-font-weight-medium);
}
.service__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.service__metric {
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.service__metric.is-high {
  color: var(--dou-color-danger-text);
}
/* a narrow list drops the request column, so the names stay whole */
@container (max-width: 320px) {
  .services__head,
  .service {
    grid-template-columns: 8px minmax(3em, 1fr) 4.5em 4.5em;
  }
  .is-rps {
    display: none;
  }
}
@media (pointer: coarse) {
  .service {
    min-height: 40px;
  }
}
</style>
