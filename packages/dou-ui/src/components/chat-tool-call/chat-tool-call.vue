<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  WrenchIcon,
} from '@dou-ui/icons'
import { computed, ref, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { CollapseTransition } from '../collapse/collapse-transition'
import { useLocale } from '../config-provider/use-config'
import DouSpinner from '../spinner/spinner.vue'
import { formatToolValue } from './chat-tool-call'
import type { ChatToolCallEmits, ChatToolCallProps, ChatToolCallSlots } from './chat-tool-call'

defineOptions({ name: 'DouChatToolCall' })

const props = withDefaults(defineProps<ChatToolCallProps>(), {
  status: 'success',
  open: undefined,
})
const emit = defineEmits<ChatToolCallEmits>()
const slots = defineSlots<ChatToolCallSlots>()

const ns = useNamespace('chat-tool-call')
const { t } = useLocale()
const id = useId()

const inner = ref(false)
const open = computed(() => props.open ?? inner.value)
function toggle() {
  inner.value = !open.value
  emit('update:open', inner.value)
}

const hasInput = computed(() => !!slots.input || props.input !== undefined)
const hasOutput = computed(() => !!slots.output || props.output !== undefined)
const expandable = computed(() => hasInput.value || hasOutput.value || !!slots.default)

const statusText = computed(
  () =>
    ({
      pending: t('chat.toolPending'),
      running: t('chat.toolRunning'),
      success: t('chat.toolSuccess'),
      error: t('chat.toolError'),
    })[props.status],
)
</script>

<template>
  <div :class="[ns.b(), ns.m(status), ns.is('open', open && expandable)]">
    <component
      :is="expandable ? 'button' : 'div'"
      :id="`${id}-trigger`"
      :type="expandable ? 'button' : undefined"
      :class="ns.e('header')"
      :aria-expanded="expandable ? open : undefined"
      :aria-controls="expandable ? `${id}-panel` : undefined"
      @click="expandable && toggle()"
    >
      <span :class="ns.e('icon')" aria-hidden="true">
        <slot name="icon"><WrenchIcon /></slot>
      </span>
      <span :class="ns.e('title')">
        <slot name="title">
          <template v-if="title">{{ title }}</template>
          <code v-else :class="ns.e('name')">{{ name }}</code>
        </slot>
      </span>
      <span :class="ns.e('status')">
        <DouSpinner v-if="status === 'running'" size="sm" aria-hidden="true" />
        <ClockIcon v-else-if="status === 'pending'" aria-hidden="true" />
        <CheckCircleIcon v-else-if="status === 'success'" aria-hidden="true" />
        <AlertCircleIcon v-else aria-hidden="true" />
        <span :class="ns.e('status-text')">{{ statusText }}</span>
      </span>
      <ChevronDownIcon v-if="expandable" :class="ns.e('arrow')" />
    </component>
    <div v-if="slots.actions" :class="ns.e('actions')"><slot name="actions" /></div>
    <CollapseTransition>
      <div
        v-if="expandable"
        v-show="open"
        :id="`${id}-panel`"
        role="region"
        :class="ns.e('panel')"
        :aria-labelledby="`${id}-trigger`"
      >
        <div :class="ns.e('body')">
          <section v-if="hasInput" :class="ns.e('section')">
            <h4 :class="ns.e('label')">{{ t('chat.toolInput') }}</h4>
            <slot name="input">
              <pre :class="ns.e('code')">{{ formatToolValue(input) }}</pre>
            </slot>
          </section>
          <section v-if="hasOutput" :class="ns.e('section')">
            <h4 :class="ns.e('label')">{{ t('chat.toolOutput') }}</h4>
            <slot name="output">
              <pre :class="[ns.e('code'), ns.is('error', status === 'error')]">{{
                formatToolValue(output)
              }}</pre>
            </slot>
          </section>
          <slot />
        </div>
      </div>
    </CollapseTransition>
  </div>
</template>
