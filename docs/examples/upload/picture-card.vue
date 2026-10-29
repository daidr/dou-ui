<script setup>
import { ref } from 'vue'

// A fake request that reports progress and fails for names containing "fail".
function fakeRequest({ raw, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    let percent = 0
    const timer = setInterval(() => {
      percent += 8 + Math.random() * 14
      if (percent >= 100) {
        clearInterval(timer)
        if (raw.name.includes('fail')) reject(new Error('服务器拒绝了这个文件'))
        else resolve({ ok: true })
      } else onProgress(percent)
    }, 200)
    signal.addEventListener('abort', () => clearInterval(timer))
  })
}
const tile = (hue) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 30% 72%)"/><stop offset="1" stop-color="hsl(${hue + 40} 28% 38%)"/></linearGradient></defs><rect width="480" height="480" fill="url(#g)"/><circle cx="340" cy="140" r="56" fill="hsl(${hue} 40% 88%)" opacity=".7"/><path d="M0 400 L130 250 L240 360 L330 280 L480 420 V480 H0Z" fill="hsl(${hue + 20} 25% 28%)" opacity=".8"/></svg>`,
  )}`
const photos = ref([
  {
    uid: 'p1',
    name: '外滩.svg',
    size: 182400,
    type: 'image/svg+xml',
    status: 'success',
    url: tile(210),
  },
  {
    uid: 'p2',
    name: '武康路.svg',
    size: 204800,
    type: 'image/svg+xml',
    status: 'success',
    url: tile(25),
  },
  { uid: 'p3', name: '会议纪要.pdf', size: 92160, type: 'application/pdf', status: 'success' },
  {
    uid: 'p4',
    name: '陆家嘴.svg',
    size: 160000,
    type: 'image/svg+xml',
    status: 'uploading',
    percent: 46,
    url: tile(160),
  },
])
</script>

<template>
  <DouUpload
    v-model="photos"
    list-type="picture-card"
    accept="image/*"
    multiple
    :max-count="8"
    :request="fakeRequest"
  />
</template>
