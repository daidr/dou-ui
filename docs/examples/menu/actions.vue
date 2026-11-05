<script setup>
import { CheckIcon, MessageIcon, PencilIcon } from '@dou-ui/icons'
import { ref, shallowRef } from 'vue'

// 项里带着图标组件，用 shallowRef，改动时整个换掉
const items = shallowRef([
  { key: 'plan', label: '上海门店排班', icon: MessageIcon, description: '等你审阅' },
  { key: 'menu', label: '秋季菜单', icon: MessageIcon, description: '等你审阅' },
  { key: 'report', label: '十月周报', icon: MessageIcon },
])
const current = ref('report')
function review(item, description) {
  items.value = items.value.map((it) => (it.key === item.key ? { ...it, description } : it))
}
</script>

<template>
  <DouMenu v-model="current" :items="items" style="width: 280px">
    <template #actions="{ item }">
      <template v-if="item.description === '等你审阅'">
        <DouTooltip content="还要改">
          <DouButton
            size="xs"
            variant="ghost"
            aria-label="还要改"
            @click="review(item, '要再改改')"
          >
            <PencilIcon />
          </DouButton>
        </DouTooltip>
        <DouTooltip content="看完了">
          <DouButton size="xs" variant="ghost" aria-label="看完了" @click="review(item, '已审阅')">
            <CheckIcon />
          </DouButton>
        </DouTooltip>
      </template>
    </template>
  </DouMenu>
</template>
