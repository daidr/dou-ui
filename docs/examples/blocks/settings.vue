<script setup>
import { BellIcon, PaletteIcon, UserIcon } from '@dou-ui/icons'
import { toast } from 'dou-ui'
import { computed, reactive, ref } from 'vue'

const sections = [
  { key: 'profile', label: '个人资料', icon: UserIcon },
  { key: 'notify', label: '通知', icon: BellIcon },
  { key: 'appearance', label: '外观', icon: PaletteIcon },
]
const current = ref('profile')

const initial = {
  name: '戴兜',
  email: 'daidr@example.com',
  bio: '在上海写前端，喜欢做好用的组件。',
  timezone: 'Asia/Shanghai',
  notify: { deploy: true, review: true, weekly: false },
  theme: 'system',
  density: 'comfortable',
}
// 深拷贝一份，保存前的修改不影响已保存的值
const clone = (value) => JSON.parse(JSON.stringify(value))
const saved = ref(clone(initial))
const model = reactive(clone(initial))
const dirty = computed(() => JSON.stringify(model) !== JSON.stringify(saved.value))

const timezones = [
  { value: 'Asia/Shanghai', label: '(UTC+08:00) 上海' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) 新加坡' },
  { value: 'Europe/Berlin', label: '(UTC+01:00) 柏林' },
  { value: 'America/New_York', label: '(UTC−05:00) 纽约' },
]
const notifications = [
  { key: 'deploy', title: '部署结果', description: '部署成功或失败时发送邮件。' },
  { key: 'review', title: '评审请求', description: '有人请你评审变更时提醒你。' },
  { key: 'weekly', title: '每周摘要', description: '每周一汇总上周的用量与告警。' },
]

function discard() {
  Object.assign(model, clone(saved.value))
}
function save() {
  saved.value = clone(model)
  toast.success('设置已保存')
}
</script>

<template>
  <div class="settings">
    <DouMenu v-model="current" :items="sections" class="settings__nav" />

    <div class="settings__main">
      <template v-if="current === 'profile'">
        <header class="settings__head">
          <DouText size="lg" weight="bold">个人资料</DouText>
          <DouText variant="secondary" size="sm">这些信息会显示在你的主页和评论中。</DouText>
        </header>
        <div class="settings__avatar">
          <DouAvatar :name="model.name" :size="56" />
          <DouSpace>
            <DouButton variant="outline" size="sm">更换头像</DouButton>
            <DouButton variant="ghost" size="sm">移除</DouButton>
          </DouSpace>
        </div>
        <DouForm :model="model" layout="horizontal" label-align="end">
          <DouFormItem label="昵称" prop="name">
            <DouInput v-model="model.name" />
          </DouFormItem>
          <DouFormItem label="邮箱" prop="email" help="用于登录和接收通知">
            <DouInput v-model="model.email" type="email" />
          </DouFormItem>
          <DouFormItem label="简介" prop="bio">
            <DouTextarea v-model="model.bio" :rows="3" :maxlength="120" show-count />
          </DouFormItem>
          <DouFormItem label="时区" prop="timezone">
            <DouSelect v-model="model.timezone" :options="timezones" />
          </DouFormItem>
        </DouForm>
      </template>

      <template v-else-if="current === 'notify'">
        <header class="settings__head">
          <DouText size="lg" weight="bold">通知</DouText>
          <DouText variant="secondary" size="sm">选择哪些事情需要通过邮件告诉你。</DouText>
        </header>
        <div class="settings__list">
          <label v-for="item in notifications" :key="item.key" class="settings__item">
            <span class="settings__text">
              <DouText weight="medium">{{ item.title }}</DouText>
              <DouText variant="secondary" size="sm">{{ item.description }}</DouText>
            </span>
            <DouSwitch v-model="model.notify[item.key]" />
          </label>
        </div>
      </template>

      <template v-else>
        <header class="settings__head">
          <DouText size="lg" weight="bold">外观</DouText>
          <DouText variant="secondary" size="sm">只影响你自己看到的界面。</DouText>
        </header>
        <DouForm :model="model" layout="horizontal" label-align="end">
          <DouFormItem label="配色">
            <DouSegmentedControl
              v-model="model.theme"
              :options="[
                { value: 'light', label: '亮色' },
                { value: 'dark', label: '暗色' },
                { value: 'system', label: '跟随系统' },
              ]"
            />
          </DouFormItem>
          <DouFormItem label="密度">
            <DouRadioGroup v-model="model.density">
              <DouRadio value="comfortable">舒适</DouRadio>
              <DouRadio value="compact">紧凑</DouRadio>
            </DouRadioGroup>
          </DouFormItem>
        </DouForm>
      </template>

      <Transition name="dou-fade">
        <div v-if="dirty" class="settings__bar" role="status">
          <DouText size="sm" variant="secondary">有未保存的更改</DouText>
          <DouSpace>
            <DouButton variant="ghost" size="sm" @click="discard">放弃</DouButton>
            <DouButton tone="primary" size="sm" @click="save">保存</DouButton>
          </DouSpace>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 32px;
  width: 100%;
  min-height: 440px;
}
.settings__main {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
  max-width: 520px;
}
.settings__head {
  display: grid;
  gap: 4px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
}
.settings__avatar {
  display: flex;
  align-items: center;
  gap: 16px;
}
.settings__list {
  display: grid;
}
.settings__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 0;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  cursor: pointer;
}
.settings__text {
  display: grid;
  gap: 2px;
}
.settings__bar {
  position: sticky;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: auto;
  padding: 8px 8px 8px 16px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-lg);
}
@media (max-width: 640px) {
  .settings {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
