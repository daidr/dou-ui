<script setup lang="ts">
import { ref } from 'vue'
import { useHotkey } from 'dou-ui'

const shortcuts = [
  { keys: 'mod+s', label: '保存草稿' },
  { keys: 'g i', label: '前往收件箱' },
  { keys: '?', label: '显示快捷键' },
]
const last = ref('')
const count = ref(0)

useHotkey(
  shortcuts.map((item) => item.keys),
  (_, hotkey) => {
    last.value = hotkey
    count.value++
  },
)
</script>

<template>
  <div class="hotkey-demo">
    <div
      v-for="item in shortcuts"
      :key="item.keys"
      class="hotkey-demo__row"
      :class="{ 'is-active': last === item.keys }"
    >
      <DouText size="sm">{{ item.label }}</DouText>
      <DouKbd size="sm" :keys="item.keys" />
    </div>
    <DouInput placeholder="在这里输入时，快捷键不会触发" />
    <DouText size="sm" variant="tertiary">
      {{
        last
          ? `第 ${count} 次触发：${shortcuts.find((item) => item.keys === last)?.label}`
          : '按下上面的快捷键试试'
      }}
    </DouText>
  </div>
</template>

<style scoped>
.hotkey-demo {
  display: grid;
  gap: 8px;
  max-width: 320px;
}

.hotkey-demo__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background-color var(--dou-motion-duration-fast) var(--dou-motion-easing);
}

.hotkey-demo__row.is-active {
  background-color: var(--dou-color-bg-muted);
}
</style>
