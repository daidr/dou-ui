<script setup>
import { ref } from 'vue'

const fields = ref([
  { id: 'name', label: '姓名', visible: true },
  { id: 'email', label: '邮箱', visible: true },
  { id: 'role', label: '角色', visible: false },
  { id: 'joined', label: '加入时间', visible: true },
])
</script>

<template>
  <DouSortable v-model="fields" handle class="fields" :item-label="(field) => field.label">
    <template #default="{ item }">
      <div class="field">
        <DouSortableHandle />
        <DouCheckbox v-model="item.visible">{{ item.label }}</DouCheckbox>
      </div>
    </template>
  </DouSortable>
</template>

<style scoped>
.fields {
  width: 240px;
  gap: 0;
  padding: 4px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}

.field {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 2px;
}
</style>
