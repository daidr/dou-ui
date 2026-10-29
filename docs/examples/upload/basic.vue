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
const files = ref([
  { uid: 'a', name: '项目说明.pdf', size: 1843200, status: 'success', url: '#' },
  { uid: 'b', name: 'avatar-fail.png', size: 238400, status: 'error' },
])
</script>

<template>
  <DouUpload
    v-model="files"
    :request="fakeRequest"
    multiple
    hint="单个文件不超过 10 MB"
    :max-size="10 * 1024 * 1024"
  />
</template>
