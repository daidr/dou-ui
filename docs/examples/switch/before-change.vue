<script setup>
import { toast } from 'dou-ui'
import { ref } from 'vue'

const sync = ref(true)
const failNext = ref(false)

// 模拟保存到服务端：成功时返回 true，失败时返回 false，开关保持原样
function save() {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (failNext.value) {
        failNext.value = false
        toast.danger('保存失败，已恢复原来的状态')
        resolve(false)
      } else resolve(true)
    }, 1000)
  })
}
</script>

<template>
  <DouSwitch v-model="sync" :before-change="save">云端同步</DouSwitch>
  <DouCheckbox v-model="failNext">下一次保存失败</DouCheckbox>
</template>
