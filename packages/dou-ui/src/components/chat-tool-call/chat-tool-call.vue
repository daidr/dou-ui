<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  ClockPauseIcon,
  WrenchIcon,
} from '@dou-ui/icons'
import { computed, ref, useId, watchEffect } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useStatusCheck, devWarn } from '../../utils/status-check'
import { DouCollapseTransition as CollapseTransition } from '../collapse/collapse-transition'
import { useLocale } from '../config-provider/use-config'
import { DouSpinner } from '../spinner'
import { DouStatusDot } from '../status-dot'
import { formatToolValue } from './chat-tool-call'
import type { ChatToolCallEmits, ChatToolCallProps, ChatToolCallSlots } from './chat-tool-call'

defineOptions({ name: 'DouChatToolCall' })

const props = withDefaults(defineProps<ChatToolCallProps>(), {
  status: 'done',
  open: undefined,
  live: true,
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

useStatusCheck(
  'DouChatToolCall',
  () => [props.status],
  ['pending', 'running', 'waiting', 'done', 'error'],
  {
    success: 'done',
  },
)

// `pending` used to mean waiting for approval; with allow buttons it almost
// certainly still does, which types can't catch.
if (process.env.NODE_ENV !== 'production') {
  watchEffect(() => {
    if (props.status !== 'pending' || !slots.actions) return
    devWarn(
      '[dou-ui] DouChatToolCall: `pending` now means not started; use `waiting` for a call that waits for approval.',
    )
  })
}

const statusText = computed(
  () =>
    ({
      pending: t('chat.toolPending'),
      running: t('chat.toolRunning'),
      waiting: t('chat.toolWaiting'),
      done: t('chat.toolDone'),
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
        <template v-if="status === 'running'">
          <DouSpinner v-if="live" size="sm" aria-hidden="true" />
          <DouStatusDot v-else />
        </template>
        <ClockIcon v-else-if="status === 'pending'" aria-hidden="true" />
        <ClockPauseIcon v-else-if="status === 'waiting'" aria-hidden="true" />
        <CheckCircleIcon v-else-if="status === 'done'" aria-hidden="true" />
        <AlertCircleIcon v-else aria-hidden="true" />
        <span :class="ns.e('status-text')">{{ statusText }}</span>
      </span>
      <ChevronDownIcon v-if="expandable" :class="ns.e('arrow')" />
    </component>
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
    <div v-if="slots.actions" :class="ns.e('actions')"><slot name="actions" /></div>
  </div>
</template>
