<script setup>
import { computed, ref } from 'vue'
import { useCountdown } from 'dou-ui'

const resendAt = ref(0)
const { remaining, done } = useCountdown(resendAt)
const seconds = computed(() => Math.ceil(remaining.value / 1000))
function send() {
  resendAt.value = Date.now() + 60 * 1000
}
</script>

<template>
  <DouButton :disabled="!done" @click="send">
    {{ done ? '发送验证码' : `${seconds} 秒后重新发送` }}
  </DouButton>
</template>
