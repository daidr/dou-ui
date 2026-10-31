<script setup>
import { DouInput, DouInputNumber } from 'dou-ui'

// 设置面板用 v-model 绑定格子的 props
const props = defineModel({ type: Object, required: true })
const set = (key, value) => (props.value = { ...props.value, [key]: value })
</script>

<template>
  <label class="field">
    <span>数值</span>
    <DouInputNumber :model-value="props.value" @update:model-value="set('value', $event)" />
  </label>
  <label class="field">
    <span>单位</span>
    <DouInput :model-value="props.suffix" @update:model-value="set('suffix', $event)" />
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-medium);
}
</style>
