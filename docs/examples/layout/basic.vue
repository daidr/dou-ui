<script setup>
import { DashboardIcon, FolderIcon, SettingsIcon, UsersIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const current = ref('overview')
const items = [
  { key: 'overview', label: '概览', icon: DashboardIcon },
  { key: 'projects', label: '项目', icon: FolderIcon },
  { key: 'members', label: '成员', icon: UsersIcon },
  { key: 'settings', label: '设置', icon: SettingsIcon },
]
</script>

<template>
  <DouLayout style="height: 360px">
    <DouLayoutHeader>
      <DouText weight="medium">DouUI 控制台</DouText>
    </DouLayoutHeader>
    <DouLayout>
      <DouLayoutAside :width="200">
        <DouMenu v-model="current" :items="items" />
      </DouLayoutAside>
      <DouLayoutMain>
        <DouCard title="概览">主区放页面内容。</DouCard>
      </DouLayoutMain>
    </DouLayout>
    <DouLayoutFooter>© 2026 DouUI</DouLayoutFooter>
  </DouLayout>
</template>
