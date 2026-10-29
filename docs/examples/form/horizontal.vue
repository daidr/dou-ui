<script setup>
import { reactive } from 'vue'

const profile = reactive({ name: 'dou-ui', domain: '', notify: ['deploy'], previews: true })
const profileRules = {
  name: { required: true, pattern: /^[\da-z-]+$/, message: '只能包含小写字母、数字和连字符' },
  notify: { type: 'array', min: 1 },
}
</script>

<template>
  <DouForm :model="profile" :rules="profileRules" layout="horizontal" label-align="end">
    <DouFormItem label="项目名称" prop="name">
      <DouInput v-model="profile.name" clearable />
    </DouFormItem>
    <DouFormItem label="自定义域名" prop="domain" help="解析生效后自动签发证书">
      <DouInput v-model="profile.domain" placeholder="example.com">
        <template #prefix>https://</template>
      </DouInput>
    </DouFormItem>
    <DouFormItem label="预览">
      <DouSwitch v-model="profile.previews">为每个分支生成预览</DouSwitch>
    </DouFormItem>
    <DouFormItem label="通知" prop="notify">
      <DouCheckboxGroup v-model="profile.notify">
        <DouCheckbox value="deploy">部署成功</DouCheckbox>
        <DouCheckbox value="fail">部署失败</DouCheckbox>
      </DouCheckboxGroup>
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit">保存</DouButton>
    </DouFormItem>
  </DouForm>
</template>
