<script setup>
import { computed, ref } from 'vue'
import { en, zhCN, zhTW } from 'dou-ui'

const packs = { zhCN, zhTW, en }
const name = ref('zhTW')
const locale = computed(() => packs[name.value])
const date = ref('2026-10-29')
const page = ref(3)
</script>

<template>
  <div class="i18n-demo">
    <DouSegmentedControl
      v-model="name"
      :options="[
        { value: 'zhCN', label: '简体中文' },
        { value: 'zhTW', label: '繁體中文' },
        { value: 'en', label: 'English' },
      ]"
    />
    <DouConfigProvider :locale="locale">
      <div class="i18n-demo__body">
        <DouDatePicker v-model="date" style="width: 200px" />
        <DouPagination v-model:page="page" :total="95" show-total />
      </div>
    </DouConfigProvider>
  </div>
</template>

<style scoped>
.i18n-demo,
.i18n-demo__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}
</style>
