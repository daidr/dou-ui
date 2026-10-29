<script setup>
import { MoreHorizontalIcon, PlusIcon, SearchIcon } from '@dou-ui/icons'
import { dialog, toast } from 'dou-ui'
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'

const regions = ['上海', '新加坡', '法兰克福']
const statuses = [
  { value: 'running', label: '运行中', tone: 'success' },
  { value: 'deploying', label: '部署中', tone: 'warning' },
  { value: 'stopped', label: '已停止', tone: 'neutral' },
]
const statusOf = (value) => statuses.find((item) => item.value === value)

// 示例数据
const names = ['docs', 'api', 'cron', 'auth', 'image', 'search', 'mail', 'billing']
const now = Date.now()
const rows = ref(
  Array.from({ length: 23 }, (_, i) => ({
    id: i + 1,
    name: `dou-${names[i % names.length]}${i >= names.length ? `-${Math.floor(i / names.length) + 1}` : ''}`,
    region: regions[i % 3],
    status: i % 7 === 3 ? 'deploying' : i % 5 === 4 ? 'stopped' : 'running',
    replicas: ((i * 7) % 12) + 1,
    updated: now - ((i * 37) % 300) * 60_000 * (i % 4 === 0 ? 30 : 1),
  })),
)

/* 筛选与分页 */
const filters = reactive({ keyword: '', status: null, region: null })
const page = ref(1)
const pageSize = 8
const filtered = computed(() =>
  rows.value.filter(
    (row) =>
      row.name.includes(filters.keyword.trim()) &&
      (!filters.status || row.status === filters.status) &&
      (!filters.region || row.region === filters.region),
  ),
)
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)
watch(filters, () => (page.value = 1))
function resetFilters() {
  Object.assign(filters, { keyword: '', status: null, region: null })
}

const columns = [
  { key: 'name', title: '服务', minWidth: 140 },
  { key: 'region', title: '区域', minWidth: 104 },
  { key: 'status', title: '状态', minWidth: 104 },
  { key: 'replicas', title: '副本', align: 'end', minWidth: 72 },
  { key: 'updated', title: '更新于', minWidth: 112 },
  { key: 'actions', title: '', width: 56, align: 'end' },
]
const selected = ref([])

/* 编辑与新建 */
const drawerOpen = ref(false)
const editing = ref(null)
const draft = reactive({ name: '', region: '上海', replicas: 1 })
const rules = {
  name: [
    { required: true, message: '请填写服务名' },
    { pattern: /^[a-z][a-z0-9-]*$/, message: '仅限小写字母、数字和 -' },
  ],
  replicas: { type: 'integer', min: 1, max: 20, message: '副本数在 1 到 20 之间' },
}
const form = useTemplateRef('form')

function openEditor(row) {
  editing.value = row ?? null
  Object.assign(
    draft,
    row
      ? { name: row.name, region: row.region, replicas: row.replicas }
      : { name: '', region: '上海', replicas: 1 },
  )
  form.value?.clearValidate()
  drawerOpen.value = true
}
async function submit() {
  const { valid } = await form.value.validate()
  if (!valid) return
  if (editing.value) Object.assign(editing.value, draft, { updated: Date.now() })
  else
    rows.value.unshift({
      id: Math.max(...rows.value.map((row) => row.id)) + 1,
      ...draft,
      status: 'deploying',
      updated: Date.now(),
    })
  drawerOpen.value = false
  toast.success(editing.value ? '已保存' : `已创建 ${draft.name}`)
}

/* 行操作与批量操作 */
async function remove(ids) {
  const ok = await dialog.confirm({
    title: ids.length > 1 ? `删除 ${ids.length} 个服务？` : '删除服务？',
    content: '删除后服务会立即停止，相关的部署记录也会一并删除。',
    tone: 'danger',
    confirmText: '删除',
  })
  if (!ok) return
  rows.value = rows.value.filter((row) => !ids.includes(row.id))
  selected.value = selected.value.filter((id) => !ids.includes(id))
  toast.success('已删除')
}
function onAction(action, row) {
  if (action === 'edit') openEditor(row)
  else if (action === 'restart') toast(`正在重启 ${row.name}`)
  else if (action === 'delete') remove([row.id])
}
</script>

<template>
  <div class="data">
    <DouPageHeader title="服务" subtitle="管理各区域的服务与副本" :show-back="false" :level="2">
      <template #extra>
        <DouButton tone="primary" @click="openEditor()">
          <template #leading><PlusIcon /></template>
          新建服务
        </DouButton>
      </template>
    </DouPageHeader>

    <div class="data__filters">
      <DouInput v-model="filters.keyword" placeholder="搜索服务名" clearable class="data__search">
        <template #prefix><SearchIcon /></template>
      </DouInput>
      <DouSelect v-model="filters.status" :options="statuses" placeholder="全部状态" clearable />
      <DouSelect v-model="filters.region" :options="regions" placeholder="全部区域" clearable />
      <DouButton variant="ghost" @click="resetFilters">重置</DouButton>
    </div>

    <div v-if="selected.length" class="data__bulk" role="status">
      <DouText size="sm">已选择 {{ selected.length }} 项</DouText>
      <DouSpace>
        <DouButton variant="ghost" size="sm" @click="selected = []">取消选择</DouButton>
        <DouButton tone="danger" variant="soft" size="sm" @click="remove(selected)">
          批量删除
        </DouButton>
      </DouSpace>
    </div>

    <DouTable v-model:selected="selected" :data="paged" :columns="columns" row-key="id" selectable>
      <template #cell-name="{ value }">
        <DouText mono>{{ value }}</DouText>
      </template>
      <template #cell-status="{ value }">
        <DouTag :tone="statusOf(value).tone" size="sm">{{ statusOf(value).label }}</DouTag>
      </template>
      <template #cell-updated="{ value }">
        <DouText variant="secondary"><DouRelativeTime :value="value" /></DouText>
      </template>
      <template #cell-actions="{ row }">
        <DouDropdown placement="bottom-end" @select="onAction($event, row)">
          <DouButton variant="ghost" size="sm" :aria-label="`${row.name} 的更多操作`">
            <MoreHorizontalIcon />
          </DouButton>
          <template #menu>
            <DouDropdownItem value="edit">编辑</DouDropdownItem>
            <DouDropdownItem value="restart">重启</DouDropdownItem>
            <DouDropdownItem value="delete" tone="danger" divided>删除</DouDropdownItem>
          </template>
        </DouDropdown>
      </template>
      <template #empty>
        <DouEmpty description="没有符合条件的服务">
          <DouButton variant="outline" size="sm" @click="resetFilters">清除筛选</DouButton>
        </DouEmpty>
      </template>
    </DouTable>

    <DouPagination
      v-model:page="page"
      :page-size="pageSize"
      :total="filtered.length"
      show-total
      class="data__pager"
    />

    <DouDrawer
      v-model:open="drawerOpen"
      :title="editing ? `编辑 ${editing.name}` : '新建服务'"
      size="400px"
    >
      <DouForm ref="form" :model="draft" :rules="rules" @submit="submit">
        <DouFormItem label="服务名" prop="name">
          <DouInput v-model="draft.name" placeholder="例如 dou-docs" />
        </DouFormItem>
        <DouFormItem label="区域" prop="region">
          <DouSegmentedControl v-model="draft.region" :options="regions" block />
        </DouFormItem>
        <DouFormItem label="副本" prop="replicas">
          <DouInputNumber v-model="draft.replicas" :min="0" />
        </DouFormItem>
      </DouForm>
      <template #footer="{ close }">
        <DouButton variant="ghost" @click="close">取消</DouButton>
        <DouButton tone="primary" @click="submit">{{ editing ? '保存' : '创建' }}</DouButton>
      </template>
    </DouDrawer>
  </div>
</template>

<style scoped>
.data {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.data__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.data__filters > :not(.data__search, .dou-button) {
  width: 132px;
}
.data__search {
  flex: 1 1 200px;
}
.data__bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 6px 6px 14px;
  border-radius: var(--dou-radius-control);
  background: color-mix(in oklab, var(--dou-color-primary) 8%, transparent);
}
.data__pager {
  justify-self: end;
}
</style>
