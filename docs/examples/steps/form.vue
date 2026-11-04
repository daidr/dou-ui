<script setup>
import { useBreakpoints } from 'dou-ui'
import { computed, reactive, ref, useTemplateRef } from 'vue'

// the steps do not fit side by side on a phone
const screen = useBreakpoints()

const regions = [
  { value: '上海', label: '上海' },
  { value: '新加坡', label: '新加坡' },
  { value: '法兰克福', label: '法兰克福' },
]
const initial = () => ({ name: '', owner: '戴兜', region: '上海', replicas: 2, notify: true })
const model = reactive(initial())
const rules = {
  name: [
    { required: true, message: '请填写服务名' },
    { pattern: /^[a-z][a-z0-9-]*$/, message: '仅限小写字母、数字和 -' },
  ],
  owner: { required: true, message: '请填写负责人' },
  region: { required: true, message: '请选择区域' },
  replicas: { type: 'integer', min: 1, max: 20, message: '副本数在 1 到 20 之间' },
}

// 每一步只校验自己的字段
const steps = [
  { title: '基本信息', fields: ['name', 'owner'] },
  { title: '部署配置', fields: ['region', 'replicas'] },
  { title: '确认', fields: [] },
]
const current = ref(0)
const done = ref(false)
// 已经走过的步骤可以点回去，后面的步骤要按顺序填写
const reached = ref(0)
const items = computed(() =>
  steps.map((step, index) => ({ title: step.title, disabled: index > reached.value })),
)
const form = useTemplateRef('form')

async function next() {
  const { valid } = await form.value.validate(steps[current.value].fields)
  if (!valid) return
  current.value++
  reached.value = Math.max(reached.value, current.value)
}
function submit() {
  if (current.value < steps.length - 1) return next()
  done.value = true
}
function restart() {
  Object.assign(model, initial())
  current.value = 0
  reached.value = 0
  done.value = false
}
</script>

<template>
  <div class="wizard">
    <DouSteps
      :direction="screen.sm ? 'horizontal' : 'vertical'"
      v-model:current="current"
      :items="items"
      :status="done ? 'done' : undefined"
      :clickable="!done"
    />

    <DouResult
      v-if="done"
      status="success"
      title="服务已创建"
      :description="`${model.name} 会在几分钟内部署到${model.region}。`"
    >
      <DouButton variant="outline" @click="restart">再创建一个</DouButton>
    </DouResult>

    <DouForm v-else ref="form" :model="model" :rules="rules" @submit="submit">
      <template v-if="current === 0">
        <DouFormItem label="服务名" prop="name">
          <DouInput v-model="model.name" placeholder="例如 dou-docs" />
        </DouFormItem>
        <DouFormItem label="负责人" prop="owner">
          <DouInput v-model="model.owner" />
        </DouFormItem>
      </template>
      <template v-else-if="current === 1">
        <DouFormItem label="区域" prop="region">
          <DouSelect v-model="model.region" :options="regions" />
        </DouFormItem>
        <DouFormItem label="副本" prop="replicas">
          <DouInputNumber v-model="model.replicas" :min="0" />
        </DouFormItem>
        <DouFormItem>
          <DouCheckbox v-model="model.notify">部署完成后通知负责人</DouCheckbox>
        </DouFormItem>
      </template>
      <DouDescriptions v-else :columns="2">
        <DouDescriptionsItem label="服务名">{{ model.name }}</DouDescriptionsItem>
        <DouDescriptionsItem label="负责人">{{ model.owner }}</DouDescriptionsItem>
        <DouDescriptionsItem label="区域">{{ model.region }}</DouDescriptionsItem>
        <DouDescriptionsItem label="副本">{{ model.replicas }}</DouDescriptionsItem>
        <DouDescriptionsItem label="通知">{{ model.notify ? '开启' : '关闭' }}</DouDescriptionsItem>
      </DouDescriptions>

      <DouSpace justify="end" class="wizard__actions">
        <DouButton v-if="current > 0" variant="ghost" @click="current--">上一步</DouButton>
        <DouButton native-type="submit" tone="primary">
          {{ current === steps.length - 1 ? '创建' : '下一步' }}
        </DouButton>
      </DouSpace>
    </DouForm>
  </div>
</template>

<style scoped>
.wizard {
  display: grid;
  gap: 24px;
  width: 100%;
  max-width: 560px;
}
.wizard__actions {
  margin-top: 8px;
}
</style>
