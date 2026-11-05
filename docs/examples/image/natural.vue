<script setup>
const picture = (width, height, hue) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 30% 72%)"/><stop offset="1" stop-color="hsl(${hue + 40} 28% 38%)"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`,
  )}`
const wide = picture(1600, 900, 210)
const tall = picture(720, 1280, 25)
const small = picture(160, 100, 160)
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 360px">
    <DouImage :src="wide" alt="宽图" max-width="100%" :max-height="320" preview />
    <DouImage :src="tall" alt="长图" max-width="100%" :max-height="320" preview />
    <DouImage :src="small" alt="小图" max-width="100%" :max-height="320" />
  </div>
</template>
