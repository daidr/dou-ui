<script setup>
import { ref } from 'vue'
import { EditIcon } from '@dou-ui/icons'

const name = ref('第三季度复盘.md')
const editing = ref(false)
</script>

<template>
  <div class="row">
    <DouEditable v-model="name" v-model:editing="editing" trigger="dblclick" class="name" />
    <DouButton
      v-if="!editing"
      size="sm"
      variant="ghost"
      aria-label="重命名"
      @click="editing = true"
    >
      <EditIcon />
    </DouButton>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  width: 100%;
  max-width: 320px;
}
.name {
  flex: 1 1 auto;
}
</style>
