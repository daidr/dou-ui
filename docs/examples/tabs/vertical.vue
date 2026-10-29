<script setup>
import { ref } from 'vue'

const tab4 = ref('profile')
</script>

<template>
  <DouTabs v-model="tab4" placement="start">
    <DouTabPanel value="profile" label="个人资料">头像、昵称与所在城市。</DouTabPanel>
    <DouTabPanel value="security" label="账号安全">密码、两步验证与登录设备。</DouTabPanel>
    <DouTabPanel value="notify" label="通知">邮件与站内信的推送规则。</DouTabPanel>
  </DouTabs>
</template>
