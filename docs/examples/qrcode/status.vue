<script setup>
import { ref } from 'vue'

const status = ref('expired')
function refresh() {
  status.value = 'loading'
  setTimeout(() => (status.value = 'active'), 1200)
}
</script>

<template>
  <DouQrcode
    value="https://ui.daidr.me/login?t=8f2c"
    :status="status"
    expired-text="登录码已过期"
    @refresh="refresh"
  />
</template>
