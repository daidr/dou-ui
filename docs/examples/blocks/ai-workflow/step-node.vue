<script setup lang="ts">
import { DouFlowPort, useFlowEditor } from '@dou-ui/flow'
import { computed } from 'vue'
import { kinds } from './steps'

const props = defineProps<{
  node: { type?: string }
  data: Record<string, any>
}>()

const kind = computed(() => kinds[props.node.type!]!)

// `{{llm.answer}}` reads as “生成回答的回答”.
const { doc } = useFlowEditor()
const summary = computed(() =>
  kind.value.summary(props.data).replace(/\{\{(\w[\w-]*)\.(\w+)\}\}/g, (match, id, key) => {
    const source = doc.value.nodes.find((n) => n.id === id)
    const sourceKind = source && kinds[source.type!]
    const output = sourceKind?.outputs.find((o) => o.key === key)
    if (!source || !sourceKind || !output) return match
    return `${(source.data?.title as string) ?? sourceKind.label}的${output.label}`
  }),
)
</script>

<template>
  <div class="step-node">
    <DouFlowPort v-if="kind.input" id="in" />
    <div class="step-node__head">
      <span class="step-node__icon"><component :is="kind.icon" /></span>
      <span class="step-node__title">{{ data.title ?? kind.label }}</span>
      <span v-if="data.status" class="step-node__status" :class="`is-${data.status}`" />
    </div>
    <div class="step-node__summary">{{ summary }}</div>
    <DouFlowPort v-if="kind.exits.length === 1" :id="kind.exits[0]!.id" />
    <div v-if="kind.exits.length > 1" class="step-node__exits">
      <div v-for="exit in kind.exits" :key="exit.id" class="step-node__exit">
        {{ exit.label }}
        <DouFlowPort :id="exit.id" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-node {
  position: relative;
  width: 192px;
}

.step-node__head {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  font-weight: var(--dou-font-weight-medium);
}

.step-node__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background-color: var(--dou-color-bg-muted);
  color: var(--dou-color-text-secondary);
}

.step-node__icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.step-node__title {
  flex: 1;
  min-width: 0;
  overflow-x: clip;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-node__status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--dou-color-text-tertiary);
}

.step-node__status.is-process {
  background-color: var(--dou-color-primary);
  animation: step-pulse 1s ease-in-out infinite;
}

.step-node__status.is-finish {
  background-color: var(--dou-color-success);
}

.step-node__status.is-error {
  background-color: var(--dou-color-danger);
}

@keyframes step-pulse {
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .step-node__status.is-process {
    animation: none;
  }
}

.step-node__summary {
  padding: 0 12px 12px 44px;
  overflow-x: clip;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-node__exits {
  display: flex;
  border-top: 1px solid var(--dou-color-border-subtle);
}

.step-node__exit {
  position: relative;
  flex: 1;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  line-height: 32px;
  text-align: center;
}

.step-node__exit + .step-node__exit {
  border-left: 1px solid var(--dou-color-border-subtle);
}
</style>
