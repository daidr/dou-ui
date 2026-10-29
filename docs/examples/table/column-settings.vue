<script setup>
import { computed, ref } from 'vue'
import { LayoutColumnsIcon } from '@dou-ui/icons'

const columns = [
  { key: 'name', title: '服务' },
  { key: 'region', title: '区域' },
  { key: 'status', title: '状态' },
  { key: 'replicas', title: '副本', align: 'end' },
  { key: 'owner', title: '负责人' },
  { key: 'updated', title: '更新时间' },
]
const rows = [
  {
    id: 1,
    name: 'edge-fn-sh',
    region: '上海',
    status: '运行中',
    replicas: 3,
    owner: '戴兜',
    updated: '2026-10-28 14:32',
  },
  {
    id: 2,
    name: 'api-sg',
    region: '新加坡',
    status: '运行中',
    replicas: 12,
    owner: '戴兜',
    updated: '2026-10-28 09:15',
  },
  {
    id: 3,
    name: 'cron-fra',
    region: '法兰克福',
    status: '已停止',
    replicas: 0,
    owner: '戴兜',
    updated: '2026-10-27 22:04',
  },
]

const initial = () =>
  columns.map((column) => ({
    key: column.key,
    title: column.title,
    visible: column.key !== 'owner',
  }))
const fields = ref(initial())
const columnKeys = computed({
  get: () => fields.value.filter((field) => field.visible).map((field) => field.key),
  set: (keys) => {
    const visible = new Set(keys)
    for (const field of fields.value) field.visible = visible.has(field.key)
  },
})
</script>

<template>
  <div class="column-demo">
    <DouPopover title="显示的列" :width="240" placement="bottom-start">
      <DouButton variant="outline" size="sm">
        <template #leading><LayoutColumnsIcon /></template>
        列设置
      </DouButton>
      <template #content>
        <DouSortable
          v-model="fields"
          item-key="key"
          handle
          class="column-fields"
          :item-label="(field) => field.title"
        >
          <template #default="{ item }">
            <div class="column-field">
              <DouSortableHandle />
              <DouCheckbox v-model="item.visible">{{ item.title }}</DouCheckbox>
            </div>
          </template>
        </DouSortable>
        <DouButton variant="ghost" size="sm" class="column-reset" @click="fields = initial()">
          恢复默认
        </DouButton>
      </template>
    </DouPopover>
    <DouTable v-model:column-keys="columnKeys" :data="rows" :columns="columns" row-key="id" />
  </div>
</template>

<style scoped>
.column-demo {
  display: grid;
  justify-items: start;
  gap: 12px;
}

.column-demo > :last-child {
  justify-self: stretch;
}

.column-fields {
  gap: 0;
  margin: 0 -8px;
}

.column-field {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 2px;
}

.column-reset {
  margin-top: 8px;
}
</style>
