<script setup lang="ts">
const name = ref('')
const city = ref('sh')
const loading = ref(false)
const { isDark } = useColorMode()

const cities = [
  { label: '上海', value: 'sh' },
  { label: '北京', value: 'bj' },
  { label: '杭州', value: 'hz' },
]

async function save() {
  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 600))
  loading.value = false
  toast.success(`已保存，${name.value || '戴兜'}`)
}

function remove() {
  dialog.confirm('删除后无法恢复。', { title: '删除草稿' })
}
</script>

<template>
  <main class="page">
    <DouToastViewport />
    <header class="head">
      <DouText as="h1" size="lg">DouUI × Nuxt</DouText>
      <DouColorModeSwitch />
    </header>
    <DouCard v-loading="loading" title="个人资料">
      <DouForm label-width="64px">
        <DouFormItem label="名字">
          <DouInput v-model="name" placeholder="戴兜">
            <template #prefix><UserIcon /></template>
          </DouInput>
        </DouFormItem>
        <DouFormItem label="城市">
          <DouSelect v-model="city" :options="cities" />
        </DouFormItem>
      </DouForm>
      <template #footer>
        <DouSpace>
          <DouButton tone="primary" @click="save">保存</DouButton>
          <DouButton variant="ghost" tone="danger" @click="remove">删除</DouButton>
          <!-- The server cannot know the visitor's color mode. -->
          <ClientOnly>
            <DouTooltip content="当前配色模式">
              <DouTag>{{ isDark ? '深色' : '浅色' }}</DouTag>
            </DouTooltip>
          </ClientOnly>
        </DouSpace>
      </template>
    </DouCard>
  </main>
</template>

<style>
.page {
  max-width: 560px;
  margin: 48px auto;
  padding: 0 16px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
</style>
