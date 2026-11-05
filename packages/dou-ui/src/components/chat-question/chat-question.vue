<script setup lang="ts">
import { CheckIcon, MessageQuestionIcon, UndoIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, watch, watchEffect } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { devWarn, useStatusCheck } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import type {
  ChatQuestionEmits,
  ChatQuestionOption,
  ChatQuestionProps,
  ChatQuestionSlots,
} from './chat-question'

defineOptions({ name: 'DouChatQuestion' })

const props = withDefaults(defineProps<ChatQuestionProps>(), {
  options: () => [],
  status: 'waiting',
})
const emit = defineEmits<ChatQuestionEmits>()
const slots = defineSlots<ChatQuestionSlots>()

const ns = useNamespace('chat-question')
const { t } = useLocale()
const id = useId()

const waiting = computed(() => props.status === 'waiting')
const chosen = computed(() => props.options.find((option) => option.value === props.answer))

function pick(option: ChatQuestionOption) {
  if (waiting.value && !option.disabled) emit('select', option.value, option)
}

// Answering or withdrawing removes the options; if focus was on one, keep
// it on the card instead of losing it to the page. The watcher runs before
// the DOM updates, while the focused option is still there to find.
const root = ref<HTMLElement>()
watch(
  () => props.status,
  (now, before) => {
    if (before !== 'waiting' || now === 'waiting') return
    if (!root.value?.contains(document.activeElement)) return
    void nextTick(() => root.value?.focus({ preventScroll: true }))
  },
)

const statuses = ['waiting', 'answered', 'withdrawn']
useStatusCheck('DouChatQuestion', () => [props.status], statuses, { pending: 'waiting' })

// Mistakes the types can't catch, with options from a server.
if (process.env.NODE_ENV !== 'production')
  watchEffect(() => {
    const seen = new Set<string | number>()
    for (const option of props.options) {
      if (seen.has(option.value))
        devWarn(
          `[dou-ui] DouChatQuestion: two options share the value ${JSON.stringify(option.value)}; values tell the options apart and name the answer, so they must differ.`,
        )
      seen.add(option.value)
    }
    if (props.status === 'waiting' && !props.options.length)
      devWarn(
        '[dou-ui] DouChatQuestion: waiting with no options, so there is nothing to answer with.',
      )
  })
</script>

<template>
  <div
    ref="root"
    :class="[ns.b(), ns.is(status)]"
    role="group"
    tabindex="-1"
    :aria-labelledby="title || slots.title ? `${id}-title` : undefined"
  >
    <div :class="ns.e('header')">
      <span :class="ns.e('icon')" aria-hidden="true">
        <slot name="icon"><MessageQuestionIcon /></slot>
      </span>
      <div :class="ns.e('text')">
        <div v-if="title || slots.title" :id="`${id}-title`" :class="ns.e('title')">
          <slot name="title">{{ title }}</slot>
        </div>
        <div v-if="description" :class="ns.e('description')">{{ description }}</div>
      </div>
      <!-- always there, so screen readers announce the outcome when it appears -->
      <span :class="ns.e('result')" role="status">
        <template v-if="status === 'answered'">
          <CheckIcon aria-hidden="true" />
          <!-- a long label is cut short: the whole of it on hover -->
          <span :class="ns.e('answer')" :title="chosen?.label">{{
            chosen?.label ?? t('chat.answered')
          }}</span>
        </template>
        <template v-else-if="status === 'withdrawn'">
          <UndoIcon aria-hidden="true" />
          {{ t('chat.withdrawn') }}
        </template>
      </span>
    </div>
    <ul v-if="waiting && options.length" :class="ns.e('options')">
      <li v-for="(option, index) in options" :key="option.value">
        <!-- named by the label alone, with the second line read as its description -->
        <button
          type="button"
          :class="ns.e('option')"
          :disabled="option.disabled"
          :aria-labelledby="slots.option ? undefined : `${id}-${index}`"
          :aria-describedby="option.description && !slots.option ? `${id}-${index}-d` : undefined"
          @click="pick(option)"
        >
          <slot name="option" :option="option">
            <component :is="option.icon" v-if="option.icon" :class="ns.e('option-icon')" />
            <span :class="ns.e('option-text')">
              <span :id="`${id}-${index}`" :class="ns.e('label')">{{ option.label }}</span>
              <span
                v-if="option.description"
                :id="`${id}-${index}-d`"
                :class="ns.e('option-description')"
                >{{ option.description }}</span
              >
            </span>
          </slot>
        </button>
      </li>
    </ul>
  </div>
</template>
