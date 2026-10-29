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
const images = ref([])
</script>

<template>
  <DouUpload
    v-model="images"
    :request="fakeRequest"
    dropzone
    multiple
    accept="image/*"
    hint="支持 PNG、JPG、WebP"
  />
</template>
