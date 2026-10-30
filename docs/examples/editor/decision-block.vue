<script setup lang="ts">
import { EditorContent, type BlockProps } from '@dou-ui/editor'
import { computed } from 'vue'

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
}>()

const states = {
  open: '待定',
  yes: '通过',
  no: '否决',
}
type State = keyof typeof states
const order = Object.keys(states) as State[]

const state = computed(() => (props.block.props.state as State) ?? 'open')

function next() {
  const index = order.indexOf(state.value)
  props.updateProps({ state: order[(index + 1) % order.length] })
}
</script>

<template>
  <div class="decision" :class="`decision--${state}`">
    <button
      type="button"
      class="decision__state"
      :disabled="!editable"
      :aria-label="`${states[state]}，点击切换`"
      @click="next"
    >
      {{ states[state] }}
    </button>
    <EditorContent class="decision__text" />
  </div>
</template>

<style scoped>
.decision {
  --decision-tone: var(--dou-color-text-secondary);

  display: flex;
  gap: 10px;
}
.decision--yes {
  --decision-tone: var(--dou-color-success);
}
.decision--no {
  --decision-tone: var(--dou-color-danger);
}

.decision__state {
  flex: none;
  height: 22px;
  /* centered on the first line of the text */
  margin-top: calc((1lh - 22px) / 2);
  padding: 0 8px;
  border: 1px solid color-mix(in oklab, var(--decision-tone) 30%, var(--dou-color-border));
  border-radius: var(--dou-radius-full);
  background: color-mix(in oklab, var(--decision-tone) 8%, var(--dou-color-bg-surface));
  color: var(--decision-tone);
  font: inherit;
  font-size: var(--dou-font-size-sm);
  line-height: 20px;
  cursor: pointer;

  &:disabled {
    cursor: default;
  }
}

.decision__text {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
