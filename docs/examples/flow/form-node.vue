<script setup lang="ts">
import { DouFlowPort } from '@dou-ui/flow'

defineProps<{
  data: { model: string; temperature: number; stream: boolean; prompt: string }
  readonly: boolean
  updateData: (patch: Record<string, unknown>) => void
}>()

const models = [
  { value: 'fast', label: '快速' },
  { value: 'balanced', label: '均衡' },
  { value: 'careful', label: '细致' },
]
</script>

<template>
  <div class="form-node">
    <div class="form-node__head">
      <DouFlowPort id="in" />
      生成回答
      <DouFlowPort id="out" />
    </div>
    <div class="form-node__body">
      <label class="form-node__field">
        <span>模型</span>
        <DouSelect
          :model-value="data.model"
          :options="models"
          size="sm"
          :disabled="readonly"
          @update:model-value="updateData({ model: $event })"
        />
      </label>
      <label class="form-node__field">
        <span>提示词</span>
        <DouInput
          :model-value="data.prompt"
          size="sm"
          :readonly="readonly"
          @update:model-value="updateData({ prompt: $event })"
        />
      </label>
      <div class="form-node__field is-inline">
        <span>流式输出</span>
        <DouSwitch
          :model-value="data.stream"
          size="sm"
          :disabled="readonly"
          @update:model-value="updateData({ stream: $event })"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-node {
  width: 256px;
}

.form-node__head {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  font-weight: var(--dou-font-weight-medium);
}

.form-node__body {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.form-node__field {
  display: grid;
  gap: 6px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}

.form-node__field.is-inline {
  grid-template-columns: 1fr auto;
  align-items: center;
}
</style>
