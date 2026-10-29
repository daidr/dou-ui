<script setup>
import { reactive, ref, useTemplateRef } from 'vue'

const regions = [
  { value: '上海', label: '上海' },
  { value: '新加坡', label: '新加坡' },
  { value: '法兰克福', label: '法兰克福' },
]
const columns = [
  { key: 'name', title: '服务' },
  { key: 'region', title: '区域', width: 136 },
  { key: 'replicas', title: '副本', width: 140 },
  { key: 'actions', title: '操作', width: 120 },
]
const rows = ref([
  { id: 1, name: 'dou-docs', region: '上海', replicas: 3 },
  { id: 2, name: 'dou-api', region: '新加坡', replicas: 12 },
  { id: 3, name: 'dou-cron', region: '法兰克福', replicas: 1 },
])

// 正在编辑的行和它的草稿，保存前不改动原数据
const editingId = ref(null)
const draft = reactive({ name: '', region: '', replicas: 0 })
const rules = {
  name: [
    { required: true, message: '请填写服务名' },
    { pattern: /^[a-z][a-z0-9-]*$/, message: '仅限小写字母、数字和 -' },
  ],
  replicas: { type: 'integer', min: 1, max: 20, message: '副本数在 1 到 20 之间' },
}
const form = useTemplateRef('form')

function edit(row) {
  Object.assign(draft, { name: row.name, region: row.region, replicas: row.replicas })
  form.value?.clearValidate()
  editingId.value = row.id
}
function cancel() {
  editingId.value = null
}
async function save() {
  const { valid } = await form.value.validate()
  if (!valid) return
  const row = rows.value.find((item) => item.id === editingId.value)
  Object.assign(row, draft)
  editingId.value = null
}
</script>

<template>
  <DouForm ref="form" :model="draft" :rules="rules" size="sm" @submit="save">
    <DouTable
      :data="rows"
      :columns="columns"
      row-key="id"
      :row-class="(row) => (row.id === editingId ? 'is-editing' : '')"
    >
      <template #cell-name="{ row, value }">
        <DouFormItem v-if="row.id === editingId" prop="name">
          <DouInput v-model="draft.name" aria-label="服务" />
        </DouFormItem>
        <DouText v-else mono>{{ value }}</DouText>
      </template>
      <template #cell-region="{ row, value }">
        <DouFormItem v-if="row.id === editingId" prop="region">
          <DouSelect v-model="draft.region" :options="regions" aria-label="区域" />
        </DouFormItem>
        <template v-else>{{ value }}</template>
      </template>
      <template #cell-replicas="{ row, value }">
        <DouFormItem v-if="row.id === editingId" prop="replicas">
          <DouInputNumber v-model="draft.replicas" :min="0" aria-label="副本" />
        </DouFormItem>
        <template v-else>{{ value }}</template>
      </template>
      <template #cell-actions="{ row }">
        <DouSpace v-if="row.id === editingId" :size="4">
          <DouButton native-type="submit" variant="soft" tone="primary" size="sm">保存</DouButton>
          <DouButton variant="ghost" size="sm" @click="cancel">取消</DouButton>
        </DouSpace>
        <DouButton
          v-else
          variant="ghost"
          size="sm"
          :disabled="editingId !== null"
          @click="edit(row)"
        >
          编辑
        </DouButton>
      </template>
    </DouTable>
  </DouForm>
</template>

<style scoped>
/* 校验信息出现在输入框下方时，同一行的其他控件保持顶端对齐 */
:deep(.is-editing td) {
  vertical-align: top;
}
</style>
