<script setup>
const logo =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect x="1" y="1" width="38" height="38" rx="10" fill="#3f56b5"/><text x="20" y="27" font-family="system-ui" font-size="20" font-weight="700" text-anchor="middle" fill="#fff">D</text><text x="48" y="27" font-family="system-ui" font-size="18" font-weight="600" fill="#3f56b5">DouUI</text></svg>',
  )
</script>

<template>
  <DouWatermark
    :image="logo"
    :width="96"
    :height="32"
    :gap="[60, 60]"
    :opacity="0.2"
    style="width: 100%"
  >
    <div style="height: 180px" />
  </DouWatermark>
</template>
