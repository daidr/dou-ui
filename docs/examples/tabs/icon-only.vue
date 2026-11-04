<script setup>
import { ref } from 'vue'
import { BellIcon, LockIcon, PaletteIcon, UserIcon } from '@dou-ui/icons'

const iconOnly = ref(true)
const tab = ref('profile')
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px">
    <DouSwitch v-model="iconOnly">只显示图标</DouSwitch>
    <DouTabs v-model="tab" placement="start" :icon-only="iconOnly" :height="200">
      <DouTabPanel value="profile" label="个人资料" :icon="UserIcon"> 戴兜 · 上海 </DouTabPanel>
      <DouTabPanel value="security" label="账号安全" :icon="LockIcon">
        密码、两步验证与登录设备。
      </DouTabPanel>
      <DouTabPanel value="notify" label="通知" :icon="BellIcon">
        邮件与站内信的推送规则。
      </DouTabPanel>
      <DouTabPanel value="appearance" label="外观" :icon="PaletteIcon">
        主题、字号与界面密度。
      </DouTabPanel>
    </DouTabs>
  </div>
</template>
