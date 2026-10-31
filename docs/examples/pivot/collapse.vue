<script setup>
import { DouButton, DouSpace } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

const config = ref({
  rows: ['region', 'city', 'category'],
  columns: ['quarter', 'month'],
  values: ['cups'],
})
// 记录折叠了哪些组，其余的组都是展开的
const collapsed = ref({ rows: [['华南'], ['华北'], ['西南']], columns: [['Q2'], ['Q3'], ['Q4']] })
const pivot = ref()
</script>

<template>
  <div class="pivot-demo">
    <DouSpace>
      <DouButton size="sm" @click="pivot.expandAll()">全部展开</DouButton>
      <DouButton size="sm" @click="pivot.collapseAll('rows')">只看大区</DouButton>
      <DouButton size="sm" @click="pivot.collapseAll('rows', 2)">只看到城市</DouButton>
    </DouSpace>
    <DouPivot
      ref="pivot"
      v-model:config="config"
      v-model:collapsed="collapsed"
      :data="orders"
      :fields="fields"
      :height="420"
    />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
</style>
