<script setup>
import { ref } from 'vue'

const launch = ref(Date.now() + ((2 * 24 + 5) * 3600 + 42 * 60) * 1000)
const sale = ref(Date.now() + 90 * 1000)
const flash = ref(Date.now() + 30 * 1000)
const ended = ref(false)
function restart() {
  sale.value = Date.now() + 90 * 1000
  ended.value = false
}
</script>

<template>
  <DouCountdown title="距离发布" :value="launch" format="D 天 HH:mm:ss" />
  <DouCountdown title="限时优惠" :value="sale" format="mm:ss" @finish="ended = true">
    <template #footer>
      <DouLink v-if="ended" @click="restart">已结束，重新开始</DouLink>
      <span v-else>结束后自动下架</span>
    </template>
  </DouCountdown>
  <DouCountdown title="秒杀" :value="flash" format="ss.SS" suffix="秒" />
</template>
