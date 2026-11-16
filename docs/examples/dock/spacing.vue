<script setup>
import { ref } from 'vue'

const panels = [
  { value: 'files', label: '文件' },
  { value: 'search', label: '搜索' },
  { value: 'log', label: '构建日志' },
]

const rows = {
  files: ['首页.vue', '订单列表.vue', '上海门店.json', '发布说明.md'],
  search: ['“上海”出现在 3 个文件里', '“戴兜”出现在 1 个文件里'],
  log: ['10:02 开始构建', '10:03 打包完成，共 42 个文件', '10:03 已部署到预览环境'],
}

const layout = ref({
  type: 'split',
  direction: 'horizontal',
  size: 45,
  start: { type: 'group', id: 'side', tabs: ['files', 'search'] },
  end: { type: 'group', id: 'main', tabs: ['log'] },
})
</script>

<template>
  <DouDock v-model="layout" :panels="panels" class="flush-dock">
    <template #default="{ value }">
      <ul class="rows">
        <li v-for="row in rows[value]" :key="row">{{ row }}</li>
      </ul>
    </template>
  </DouDock>
</template>

<style scoped>
.flush-dock {
  --dou-dock-group-padding-x: 0px;
  --dou-dock-header-padding-x: 12px;
  --dou-dock-panel-gap: 0px;
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--dou-font-size-sm);

  & li {
    padding: 8px 12px;
    border-bottom: 1px solid var(--dou-color-border);
  }
}
</style>
