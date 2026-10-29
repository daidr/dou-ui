<script setup>
import { ref } from 'vue'

const channels = ref(['邮件', 'Webhook'])
</script>

<template>
  <DouSelect v-model="channels" multiple :options="['邮件', '短信', 'Webhook', 'Slack']" />
</template>
