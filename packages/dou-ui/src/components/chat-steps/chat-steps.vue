<script setup lang="ts">
import { AlertCircleIcon, ChevronDownIcon } from '@dou-ui/icons'
import { computed, ref, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { CollapseTransition } from '../collapse/collapse-transition'
import { useLocale } from '../config-provider/use-config'
import DouShimmer from '../shimmer/shimmer.vue'
import DouSpinner from '../spinner/spinner.vue'
import type { ChatStepsEmits, ChatStepsProps, ChatStepsSlots } from './chat-steps'

defineOptions({ name: 'DouChatSteps' })

const props = withDefaults(defineProps<ChatStepsProps>(), {
  items: () => [],
  running: undefined,
  open: undefined,
})
const emit = defineEmits<ChatStepsEmits>()
const slots = defineSlots<ChatStepsSlots>()

const ns = useNamespace('chat-steps')
const { t } = useLocale()
const id = useId()

const inner = ref(false)
const open = computed(() => props.open ?? inner.value)
function toggle() {
  inner.value = !open.value
  emit('update:open', inner.value)
}

// the last running step; a loop, since `findLast` needs a newer lib than the build targets
const current = computed(() => {
  for (let i = props.items.length - 1; i >= 0; i--) {
    if (props.items[i]!.status === 'running') return props.items[i]
  }
  return undefined
})
const running = computed(() => props.running ?? !!current.value)
const summary = computed(() => {
  if (props.title) return props.title
  if (running.value) return current.value?.label ?? t('chat.working')
  return t('chat.stepsDone', { count: props.items.length })
})
</script>

<template>
  <div :class="[ns.b(), ns.is('open', open), ns.is('running', running)]">
    <button
      :id="`${id}-trigger`"
      type="button"
      :class="ns.e('header')"
      :aria-expanded="open"
      :aria-controls="`${id}-panel`"
      @click="toggle"
    >
      <span :class="ns.e('title')">
        <slot name="title" :running="running" :count="items.length">
          <DouShimmer :active="running">{{ summary }}</DouShimmer>
        </slot>
      </span>
      <ChevronDownIcon :class="ns.e('arrow')" />
    </button>
    <CollapseTransition>
      <div
        v-show="open"
        :id="`${id}-panel`"
        role="region"
        :class="ns.e('panel')"
        :aria-labelledby="`${id}-trigger`"
      >
        <ol :class="ns.e('list')">
          <li
            v-for="(step, index) in items"
            :key="step.key ?? index"
            :class="[ns.e('step'), ns.is(step.status ?? 'done')]"
          >
            <span :class="ns.e('mark')">
              <DouSpinner
                v-if="step.status === 'running'"
                size="sm"
                :label="t('chat.stepRunning')"
              />
              <AlertCircleIcon v-else-if="step.status === 'error'" :label="t('chat.stepError')" />
              <component :is="step.icon" v-else-if="step.icon" />
              <span v-else :class="ns.e('dot')" />
            </span>
            <div :class="ns.e('body')">
              <div :class="ns.e('line')">
                <slot name="step" :step="step" :index="index">
                  <span :class="ns.e('label')">{{ step.label }}</span>
                  <span v-if="step.detail" :class="ns.e('detail')">{{ step.detail }}</span>
                </slot>
              </div>
              <div v-if="slots.detail" :class="ns.e('extra')">
                <slot name="detail" :step="step" :index="index" />
              </div>
            </div>
          </li>
        </ol>
      </div>
    </CollapseTransition>
  </div>
</template>
