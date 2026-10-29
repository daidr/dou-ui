<script setup>
const tile = (hue) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 30% 72%)"/><stop offset="1" stop-color="hsl(${hue + 40} 28% 38%)"/></linearGradient></defs><rect width="960" height="640" fill="url(#g)"/><circle cx="700" cy="200" r="90" fill="hsl(${hue} 40% 88%)" opacity=".7"/><path d="M0 520 L260 330 L460 480 L640 360 L960 560 V640 H0Z" fill="hsl(${hue + 20} 25% 28%)" opacity=".8"/></svg>`,
  )}`
const gallery = [210, 160, 25, 280].map(tile)
const one = gallery[0]
</script>

<template>
  <DouImage :src="one" alt="远山与月亮" :width="180" :height="120" />
  <DouImage :src="one" alt="远山与月亮" :width="120" :height="120" fit="contain" />
</template>
