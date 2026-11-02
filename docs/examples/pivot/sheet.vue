<script setup>
import { DouButton } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { DouSheet } from '@dou-ui/sheet'
import { ref, shallowRef } from 'vue'
import { fields, orders } from './orders'

const config = ref({
  rows: ['region'],
  columns: ['category'],
  values: [{ field: 'amount', show: 'percentOfRow' }],
})
const pivot = ref()
const book = shallowRef(null)
</script>

<template>
  <div class="pivot-demo">
    <DouPivot
      ref="pivot"
      v-model:config="config"
      :data="orders"
      :fields="fields"
      :max-height="240"
    />
    <div>
      <DouButton variant="outline" @click="book = pivot.toSheet({ name: '品类占比' })">
        转成电子表格
      </DouButton>
    </div>
    <DouSheet v-if="book" v-model="book" class="sheet" :row-height="28" />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
.sheet {
  height: 240px;
}
</style>
