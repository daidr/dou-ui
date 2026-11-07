<script setup>
import { ref, useTemplateRef } from 'vue'
import { dockGroups, moveDockTab } from 'dou-ui'

const files = [
  { value: 'route', label: '骑行路线.md' },
  { value: 'gear', label: '装备清单.md' },
  { value: 'budget', label: '费用预算.csv' },
  { value: 'photos', label: '照片说明.md' },
]

const dock = useTemplateRef('dock')
const layout = ref({ type: 'group', id: 'main', tabs: ['route'] })
// a click opens it in the first group, a drag puts it wherever it lands
function open(value) {
  layout.value = moveDockTab(layout.value, value, dockGroups(layout.value)[0].id)
}
</script>

<template>
  <div class="workspace">
    <ul class="files" aria-label="文件">
      <li v-for="file in files" :key="file.value">
        <button type="button" @click="open(file.value)" @pointerdown="dock.startDrag($event, file)">
          {{ file.label }}
        </button>
      </li>
    </ul>
    <DouDock ref="dock" v-model="layout" :panels="files">
      <template #default="{ value }">
        {{ files.find((file) => file.value === value).label }}的内容。
      </template>
    </DouDock>
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  width: 100%;
  height: 100%;
}

.files {
  margin: 0;
  padding: 8px;
  border-right: 1px solid var(--dou-color-border);
  list-style: none;
}

.files button {
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--dou-radius-control);
  background: none;
  color: var(--dou-color-text);
  font: inherit;
  text-align: left;
  cursor: grab;
  touch-action: pan-y;
}

.files button:hover {
  background-color: var(--dou-color-bg-muted);
}

.files button:focus-visible {
  outline: 2px solid var(--dou-color-focus);
  outline-offset: -2px;
}
</style>
