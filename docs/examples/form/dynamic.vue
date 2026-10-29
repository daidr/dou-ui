<script setup>
import { reactive, ref } from 'vue'
import { PlusIcon, TrashIcon } from '@dou-ui/icons'

let nextId = 2
const team = reactive({
  name: '设计组',
  contacts: [{ id: 1, name: '戴兜', email: '' }],
})
const rules = {
  name: { required: true },
  contacts: { required: true, message: '至少添加一位联系人' },
}
const nameRules = { required: true, message: '请填写姓名' }
const emailRules = [{ required: true, message: '请填写邮箱' }, { type: 'email' }]

function add() {
  team.contacts.push({ id: nextId++, name: '', email: '' })
}
function remove(index) {
  team.contacts.splice(index, 1)
}
function onReset() {
  team.contacts.splice(0, team.contacts.length, { id: nextId++, name: '戴兜', email: '' })
}

const submitted = ref('')
function onSubmit(model) {
  submitted.value = JSON.stringify(model.contacts.map(({ name, email }) => ({ name, email })))
}
</script>

<template>
  <DouForm :model="team" :rules="rules" @submit="onSubmit" @reset="onReset">
    <DouFormItem label="团队名称" prop="name">
      <DouInput v-model="team.name" />
    </DouFormItem>
    <div v-for="(contact, index) in team.contacts" :key="contact.id" class="contact">
      <div class="contact__head">
        <DouText size="sm" weight="medium">联系人 {{ index + 1 }}</DouText>
        <DouButton
          variant="ghost"
          size="sm"
          :aria-label="`删除联系人 ${index + 1}`"
          @click="remove(index)"
        >
          <TrashIcon />
        </DouButton>
      </div>
      <div class="contact__fields">
        <DouFormItem label="姓名" :prop="`contacts.${index}.name`" :rules="nameRules">
          <DouInput v-model="contact.name" />
        </DouFormItem>
        <DouFormItem label="邮箱" :prop="`contacts.${index}.email`" :rules="emailRules">
          <DouInput v-model="contact.email" placeholder="you@example.com" />
        </DouFormItem>
      </div>
    </div>
    <DouFormItem prop="contacts">
      <DouButton variant="outline" @click="add">
        <template #leading><PlusIcon /></template>
        添加联系人
      </DouButton>
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit">保存</DouButton>
      <DouButton native-type="reset" variant="ghost">重置</DouButton>
    </DouFormItem>
  </DouForm>
  <DouText v-if="submitted" variant="tertiary" size="sm" mono>{{ submitted }}</DouText>
</template>

<style scoped>
.contact {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 16px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}
.contact__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-right: -8px;
}
.contact__fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
</style>
