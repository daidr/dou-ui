<script setup>
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 8px">
    <DouButton size="sm" variant="outline" style="align-self: flex-start" @click="open = !open">
      {{ open ? '收起' : '更多选项' }}
    </DouButton>
    <DouCollapseTransition>
      <div v-show="open">
        <div style="padding-top: 4px; color: var(--dou-color-text-secondary)">
          上海节点的备份每天凌晨 3 点进行，保留最近 7 份。
        </div>
      </div>
    </DouCollapseTransition>
  </div>
</template>
