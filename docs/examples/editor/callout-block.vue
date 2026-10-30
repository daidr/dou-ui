<script setup lang="ts">
import { EditorContent, type BlockProps } from '@dou-ui/editor'
import { AlertTriangleIcon, InfoIcon, LightbulbIcon } from '@dou-ui/icons'
import { computed } from 'vue'

const props = defineProps<{
  block: { type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
}>()

const tones = {
  info: { icon: InfoIcon, label: '说明' },
  tip: { icon: LightbulbIcon, label: '提示' },
  warning: { icon: AlertTriangleIcon, label: '注意' },
}
type Tone = keyof typeof tones
const order = Object.keys(tones) as Tone[]

const tone = computed(() => (props.block.props.tone as Tone) ?? 'info')

function next() {
  const index = order.indexOf(tone.value)
  props.updateProps({ tone: order[(index + 1) % order.length] })
}
</script>

<template>
  <div class="callout" :class="`callout--${tone}`">
    <button
      type="button"
      class="callout__icon"
      :disabled="!editable"
      :aria-label="`${tones[tone].label}，点击切换`"
      @click="next"
    >
      <component :is="tones[tone].icon" />
    </button>
    <EditorContent class="callout__text" />
  </div>
</template>

<style scoped>
.callout {
  --callout-tone: var(--dou-color-text-secondary);

  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid color-mix(in oklab, var(--callout-tone) 22%, var(--dou-color-border));
  border-radius: calc(var(--dou-radius-control) + 2px);
  background: color-mix(in oklab, var(--callout-tone) 6%, var(--dou-color-bg-surface));
}
.callout--tip {
  --callout-tone: var(--dou-color-success);
}
.callout--warning {
  --callout-tone: var(--dou-color-warning);
}

.callout__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  /* centered on the first line of the text */
  margin-top: calc((1lh - 24px) / 2);
  padding: 0;
  border: 0;
  border-radius: var(--dou-radius-control);
  background: none;
  color: var(--callout-tone);
  font: inherit;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: color-mix(in oklab, var(--callout-tone) 12%, transparent);
  }
  &:disabled {
    cursor: default;
  }
  & > svg {
    width: 16px;
    height: 16px;
  }
}

.callout__text {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
