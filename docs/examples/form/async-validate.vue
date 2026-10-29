<script setup>
import { reactive } from 'vue'

const signup = reactive({ username: '' })
const taken = ['admin', 'root', 'daidr']
const signupRules = {
  username: [
    { required: true },
    {
      validator: (value) =>
        new Promise((resolve) =>
          setTimeout(() => resolve(taken.includes(value) ? '用户名已被占用' : true), 400),
        ),
    },
  ],
}
</script>

<template>
  <DouForm :model="signup" :rules="signupRules">
    <DouFormItem label="用户名" prop="username" help="试试 admin">
      <DouInput v-model="signup.username" />
    </DouFormItem>
  </DouForm>
</template>
