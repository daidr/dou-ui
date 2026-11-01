<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouCheckbox, DouInput } from 'dou-ui'
import { computed, ref } from 'vue'

// 待办存在格子的 props 里，和布局一起保存；勾选、添加都可以撤销
const { props, setProps } = useDashboardWidget()
const items = computed(() => props.value.items ?? [])
const left = computed(() => items.value.filter((item) => !item.done).length)
const draft = ref('')

function toggle(index, done) {
  setProps({
    items: items.value.map((item, i) => (i === index ? { ...item, done } : item)),
  })
}
function add() {
  const text = draft.value.trim()
  if (!text) return
  setProps({ items: [...items.value, { text, done: false }] })
  draft.value = ''
}
</script>

<template>
  <div class="todo">
    <p class="todo__count">还有 {{ left }} 项</p>
    <ul class="todo__list">
      <li v-for="(item, index) in items" :key="index">
        <DouCheckbox
          :model-value="item.done"
          :class="{ 'is-done': item.done }"
          @update:model-value="toggle(index, $event)"
        >
          {{ item.text }}
        </DouCheckbox>
      </li>
    </ul>
    <form class="todo__add" @submit.prevent="add">
      <DouInput v-model="draft" size="sm" placeholder="添加待办，回车保存" aria-label="添加待办" />
    </form>
  </div>
</template>

<style scoped>
.todo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}
.todo__count {
  margin: 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
.todo__list {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: 6px;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}
.is-done {
  color: var(--dou-color-text-tertiary);
  text-decoration: line-through;
}
</style>
