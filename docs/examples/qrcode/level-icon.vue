<script setup>
const logo =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1f1f22"/><text x="16" y="22" font-family="system-ui" font-size="16" font-weight="700" text-anchor="middle" fill="#fff">D</text></svg>',
  )
</script>

<template>
  <DouQrcode value="https://ui.daidr.me" level="L" :size="120" />
  <DouQrcode value="https://ui.daidr.me" level="H" :size="120" />
  <DouQrcode value="https://ui.daidr.me" :icon="logo" :size="120" />
</template>
