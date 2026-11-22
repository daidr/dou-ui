<script setup>
import { ref } from 'vue'

const mode = ref('both')
const size = ref(42)
const chatDraft = ref('')
const noteDraft = ref('')
</script>

<template>
  <div class="single-wrap">
    <div class="single-toolbar">
      <DouSegmentedControl
        v-model="mode"
        size="sm"
        :options="[
          { value: 'both', label: '双栏' },
          { value: 'start', label: '仅左栏' },
          { value: 'end', label: '仅右栏' },
        ]"
      />
    </div>
    <div class="single-body">
      <DouSplitter v-model="size" :single-pane="mode === 'both' ? null : mode">
        <template #start>
          <div class="single-pane">
            <div class="single-title">主对话（start）</div>
            <DouInput v-model="chatDraft" placeholder="输入草稿后切换视图，内容会保持挂载" />
          </div>
        </template>
        <template #end>
          <div class="single-pane">
            <div class="single-title">工作区（end）</div>
            <DouInput v-model="noteDraft" placeholder="右侧草稿同样保持挂载" />
          </div>
        </template>
      </DouSplitter>
    </div>
  </div>
</template>

<style scoped>
.single-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.single-toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--dou-color-border);
}

.single-body {
  flex: 1 1 auto;
  min-height: 0;
}

.single-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  height: 100%;
  padding: 12px 16px;
}

.single-title {
  color: var(--dou-color-text-secondary);
  font-size: 13px;
}
</style>
