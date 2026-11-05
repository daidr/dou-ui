<script setup lang="ts">
import type { FlowNode } from '@dou-ui/flow'
import { libraries, models, queues, type StepKind } from './steps'

defineProps<{
  node: FlowNode
  kind: StepKind
  /** Outputs of earlier steps, which text fields can refer to. */
  upstream: { token: string; label: string }[]
}>()

const emit = defineEmits<{
  update: [patch: Record<string, unknown>]
  insert: [field: string, token: string]
}>()

const channels = ['网页', '小程序', '邮件'].map((value) => ({ value, label: value }))
</script>

<template>
  <DouForm layout="vertical" size="sm">
    <DouFormItem label="名称">
      <DouInput
        :model-value="(node.data?.title as string) ?? ''"
        :placeholder="kind.label"
        @update:model-value="emit('update', { title: $event || undefined })"
      />
    </DouFormItem>

    <DouFormItem v-if="node.type === 'start'" label="渠道">
      <DouSelect
        :model-value="node.data?.channel as string"
        :options="channels"
        @update:model-value="emit('update', { channel: $event })"
      />
    </DouFormItem>

    <template v-if="node.type === 'retrieve'">
      <DouFormItem label="知识库">
        <DouSelect
          :model-value="node.data?.library as string"
          :options="libraries"
          @update:model-value="emit('update', { library: $event })"
        />
      </DouFormItem>
      <DouFormItem label="取几段">
        <DouInputNumber
          :model-value="node.data?.topK as number"
          :min="1"
          :max="20"
          @update:model-value="emit('update', { topK: $event })"
        />
      </DouFormItem>
    </template>

    <template v-if="node.type === 'llm'">
      <DouFormItem label="模型">
        <DouSelect
          :model-value="node.data?.model as string"
          :options="models"
          @update:model-value="emit('update', { model: $event })"
        />
      </DouFormItem>
      <DouFormItem label="温度">
        <DouSlider
          :model-value="node.data?.temperature as number"
          :min="0"
          :max="1"
          :step="0.1"
          @update:model-value="emit('update', { temperature: $event })"
        />
      </DouFormItem>
    </template>

    <DouFormItem v-if="node.type === 'branch'" label="条件">
      <DouInput
        :model-value="node.data?.condition as string"
        @update:model-value="emit('update', { condition: $event })"
      />
    </DouFormItem>

    <DouFormItem v-if="node.type === 'human'" label="转给">
      <DouSelect
        :model-value="node.data?.queue as string"
        :options="queues"
        @update:model-value="emit('update', { queue: $event })"
      />
    </DouFormItem>

    <template v-for="field in ['query', 'prompt', 'content']" :key="field">
      <DouFormItem
        v-if="field in (node.data ?? {})"
        :label="{ query: '检索内容', prompt: '提示词', content: '回复内容' }[field]"
      >
        <div class="step-fields__text">
          <DouTextarea
            :model-value="node.data?.[field] as string"
            :autosize="{ minRows: 2, maxRows: 8 }"
            @update:model-value="emit('update', { [field]: $event })"
          />
          <div v-if="upstream.length" class="step-fields__refs">
            <span class="step-fields__hint">插入前面步骤的结果：</span>
            <button
              v-for="ref in upstream"
              :key="ref.token"
              type="button"
              class="step-fields__ref"
              @click="emit('insert', field, ref.token)"
            >
              {{ ref.label }}
            </button>
          </div>
        </div>
      </DouFormItem>
    </template>
  </DouForm>
</template>

<style scoped>
.step-fields__text {
  display: grid;
  gap: 8px;
  width: 100%;
}

.step-fields__refs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.step-fields__hint {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.step-fields__ref {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--dou-color-border);
  border-radius: 6px;
  background-color: var(--dou-color-bg-surface);
  color: var(--dou-color-text-secondary);
  font: inherit;
  font-size: var(--dou-font-size-sm);
  cursor: pointer;
}

.step-fields__ref:hover {
  border-color: var(--dou-color-border-strong);
  color: var(--dou-color-text);
}

.step-fields__ref:focus-visible {
  outline: 2px solid var(--dou-color-focus);
  outline-offset: 1px;
}
</style>
