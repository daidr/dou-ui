<script setup>
import { DouCheckbox, DouCheckboxGroup } from 'dou-ui'
import { shortcuts } from './shortcuts'

const props = defineModel({ type: Object, required: true })
const setIds = (ids) => (props.value = { ...props.value, ids })
</script>

<template>
  <fieldset class="field">
    <legend>显示的入口</legend>
    <DouCheckboxGroup
      :model-value="props.ids ?? []"
      direction="vertical"
      @update:model-value="setIds"
    >
      <DouCheckbox v-for="item in shortcuts" :key="item.id" :value="item.id">{{
        item.label
      }}</DouCheckbox>
    </DouCheckboxGroup>
  </fieldset>
</template>

<style scoped>
.field {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: 8px;
  padding: 0;
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-medium);
}
</style>
