<script setup lang="ts">
import { DouFlowPort } from '@dou-ui/flow'
import { variables } from './variables'

defineProps<{
  data: { mode: 'get' | 'set'; name: string }
  readonly: boolean
  updateData: (patch: Record<string, unknown>) => void
}>()

const options = Object.entries(variables).map(([value, v]) => ({ value, label: v.label }))
</script>

<template>
  <div class="variable-node">
    <div class="variable-node__head">
      <DouFlowPort v-if="data.mode === 'set'" id="value" />
      {{ data.mode === 'get' ? '读取变量' : '设置变量' }}
      <DouFlowPort v-if="data.mode === 'get'" id="value" />
    </div>
    <div class="variable-node__body">
      <DouSelect
        :model-value="data.name"
        :options="options"
        size="sm"
        :disabled="readonly"
        @update:model-value="updateData({ name: $event })"
      />
    </div>
  </div>
</template>

<style scoped>
.variable-node {
  width: 192px;
}

.variable-node__head {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  font-weight: var(--dou-font-weight-medium);
}

.variable-node__body {
  padding: 12px;
}
</style>
