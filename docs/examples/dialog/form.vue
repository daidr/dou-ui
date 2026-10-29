<script setup>
import { ref } from 'vue'

const form = ref(false)
const email = ref('')
</script>

<template>
  <DouButton variant="outline" @click="form = true">邀请成员</DouButton>
  <DouDialog v-model:open="form" title="邀请成员">
    <DouForm>
      <DouFormItem label="邮箱" help="成员会收到一封邀请邮件">
        <DouInput v-model="email" placeholder="name@example.com" autofocus />
      </DouFormItem>
    </DouForm>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">取消</DouButton>
      <DouButton @click="close">发送邀请</DouButton>
    </template>
  </DouDialog>
</template>
