<script setup>
import { reactive } from 'vue'
import * as v from 'valibot'

const profile = reactive({ name: '', email: '', age: undefined })

const schema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2, '名称至少 2 个字')),
  email: v.pipe(v.string(), v.email('邮箱格式不对')),
  age: v.pipe(v.number('请填写年龄'), v.integer(), v.minValue(18, '需要年满 18 岁')),
})
</script>

<template>
  <DouForm :model="profile" :schema="schema">
    <DouFormItem label="名称" prop="name" required>
      <DouInput v-model="profile.name" placeholder="戴兜" />
    </DouFormItem>
    <DouFormItem label="邮箱" prop="email" required>
      <DouInput v-model="profile.email" />
    </DouFormItem>
    <DouFormItem label="年龄" prop="age" required>
      <DouInputNumber v-model="profile.age" />
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit">保存</DouButton>
    </DouFormItem>
  </DouForm>
</template>
