<script setup>
import { DouPivot, DouPivotFields } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

const config = ref({
  rows: ['region'],
  columns: [{ field: 'date', by: 'quarter' }],
  values: ['amount'],
})
</script>

<template>
  <div class="pivot-demo">
    <DouPivotFields v-model:config="config" class="panel" :data="orders" :fields="fields" />
    <DouPivot
      v-model:config="config"
      class="table"
      :data="orders"
      :fields="fields"
      :max-height="520"
    />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 12px;
}
.panel {
  flex: none;
  width: 280px;
}
.table {
  flex: 1;
}
@media (max-width: 639px) {
  .pivot-demo {
    flex-direction: column;
    align-items: stretch;
  }
  .panel {
    width: auto;
  }
  /* in a column, flex: 1 would take the table's height away */
  .table {
    flex: none;
  }
}
</style>
