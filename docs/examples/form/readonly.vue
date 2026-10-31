<script setup>
import { reactive, ref } from 'vue'

const editing = ref(false)
const profile = reactive({
  name: '戴兜',
  city: 'sh',
  birthday: '1998-05-20',
  tags: ['design', 'frontend'],
  notify: true,
  level: 3,
})
const cities = [
  { label: '上海', value: 'sh' },
  { label: '杭州', value: 'hz' },
  { label: '成都', value: 'cd' },
]
</script>

<template>
  <DouSwitch v-model="editing">编辑</DouSwitch>
  <DouForm :model="profile" :readonly="!editing" layout="horizontal" label-width="64px">
    <DouFormItem label="名字" prop="name">
      <DouInput v-model="profile.name" />
    </DouFormItem>
    <DouFormItem label="城市" prop="city">
      <DouSelect v-model="profile.city" :options="cities" />
    </DouFormItem>
    <DouFormItem label="生日" prop="birthday">
      <DouDatePicker v-model="profile.birthday" />
    </DouFormItem>
    <DouFormItem label="方向" prop="tags">
      <DouCheckboxGroup v-model="profile.tags">
        <DouCheckbox value="design">设计</DouCheckbox>
        <DouCheckbox value="frontend">前端</DouCheckbox>
        <DouCheckbox value="backend">后端</DouCheckbox>
      </DouCheckboxGroup>
    </DouFormItem>
    <DouFormItem label="通知" prop="notify">
      <DouSwitch v-model="profile.notify" />
    </DouFormItem>
    <DouFormItem label="等级" prop="level">
      <DouRate v-model="profile.level" />
    </DouFormItem>
  </DouForm>
</template>
