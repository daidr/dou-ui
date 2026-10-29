<script setup>
import { DashboardIcon, FolderIcon, SettingsIcon, UsersIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const narrow = ref(false)
const current = ref('overview')
const items = [
  { key: 'overview', label: '概览', icon: DashboardIcon },
  { key: 'projects', label: '项目', icon: FolderIcon },
  { key: 'members', label: '成员', icon: UsersIcon },
  { key: 'settings', label: '设置', icon: SettingsIcon },
]
</script>

<template>
  <DouSwitch v-model="narrow">模拟窄屏</DouSwitch>
  <div style="width: 100%; overflow: hidden; border-radius: 8px">
    <DouLayout style="height: 280px">
      <DouLayoutHeader>
        <DouLayoutAsideTrigger />
        <DouText weight="medium">DouUI 控制台</DouText>
      </DouLayoutHeader>
      <DouLayout>
        <DouLayoutAside :width="200" :breakpoint="narrow ? 100000 : 768">
          <template #default="{ close }">
            <DouMenu v-model="current" :items="items" @select="close" />
          </template>
        </DouLayoutAside>
        <DouLayoutMain>
          <DouText variant="secondary">
            {{ narrow ? '点左上角的按钮打开侧栏' : '宽屏下侧栏在页面里' }}
          </DouText>
        </DouLayoutMain>
      </DouLayout>
    </DouLayout>
  </div>
</template>
