<script setup>
import { DashboardIcon, FolderIcon, SettingsIcon, UsersIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const collapsed = ref(false)
const current = ref('overview')
const items = [
  { key: 'overview', label: '概览', icon: DashboardIcon },
  { key: 'projects', label: '项目', icon: FolderIcon },
  { key: 'members', label: '成员', icon: UsersIcon },
  { key: 'settings', label: '设置', icon: SettingsIcon },
]
</script>

<template>
  <DouLayout style="height: 320px">
    <DouLayoutAside v-model:collapsed="collapsed" collapsible>
      <template #default="{ collapsed }">
        <DouMenu v-model="current" :items="items" :collapsed="collapsed" />
      </template>
    </DouLayoutAside>
    <DouLayoutMain>
      <DouText variant="secondary">侧栏{{ collapsed ? '已收起' : '已展开' }}</DouText>
    </DouLayoutMain>
  </DouLayout>
</template>
