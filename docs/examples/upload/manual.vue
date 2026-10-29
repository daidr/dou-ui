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
const manual = ref([])
const upload = ref()
</script>

<template>
  <DouUpload ref="upload" v-model="manual" :request="fakeRequest" :auto-upload="false" multiple />
  <DouButton
    size="sm"
    variant="solid"
    :disabled="!manual.length"
    style="align-self: flex-start"
    @click="upload.submit()"
  >
    开始上传
  </DouButton>
</template>
