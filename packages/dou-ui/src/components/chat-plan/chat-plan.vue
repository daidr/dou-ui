<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockPauseIcon,
  ListChecksIcon,
} from '@dou-ui/icons'
import { computed, ref, useId, watchEffect } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouCollapseTransition as CollapseTransition } from '../collapse/collapse-transition'
import { useLocale } from '../config-provider/use-config'
import { DouShimmer } from '../shimmer'
import { DouSpinner } from '../spinner'
import { DouStatusDot } from '../status-dot'
import type { ChatPlanEmits, ChatPlanProps, ChatPlanSlots } from './chat-plan'

defineOptions({ name: 'DouChatPlan' })

const props = withDefaults(defineProps<ChatPlanProps>(), {
  items: () => [],
  collapsible: true,
  open: undefined,
  live: true,
})
const emit = defineEmits<ChatPlanEmits>()
defineSlots<ChatPlanSlots>()

const ns = useNamespace('chat-plan')
const { t } = useLocale()
const id = useId()

const inner = ref(true)
const open = computed(() => !props.collapsible || (props.open ?? inner.value))
function toggle() {
  inner.value = !open.value
  emit('update:open', inner.value)
}

// Say once, while developing, that `open` does nothing on a plain panel.
// The app's bundler replaces this, as for Vue's own warnings.
if (process.env.NODE_ENV !== 'production') {
  let warned = false
  watchEffect(() => {
    if (warned || props.collapsible || props.open === undefined) return
    warned = true
    console.warn('[dou-ui] DouChatPlan: `open` is ignored when `collapsible` is false.')
  })
}

const finished = computed(
  () => props.items.filter((item) => item.status === 'done' || item.status === 'skipped').length,
)
// `live` false: the run has stopped, so a running step holds still
const running = computed(() => props.live && props.items.some((item) => item.status === 'running'))
</script>

<template>
  <div
    :class="[
      ns.b(),
      ns.is('collapsible', collapsible),
      ns.is('open', open),
      ns.is('running', running),
    ]"
  >
    <component
      :is="collapsible ? 'button' : 'div'"
      :id="`${id}-header`"
      :class="ns.e('header')"
      :type="collapsible ? 'button' : undefined"
      :aria-expanded="collapsible ? open : undefined"
      :aria-controls="collapsible ? `${id}-panel` : undefined"
      @click="collapsible && toggle()"
    >
      <ListChecksIcon :class="ns.e('icon')" />
      <span :class="ns.e('title')">{{ title ?? t('chat.plan') }}</span>
      <span :class="ns.e('count')">{{ finished }} / {{ items.length }}</span>
      <ChevronDownIcon v-if="collapsible" :class="ns.e('arrow')" />
    </component>
    <CollapseTransition>
      <div
        v-show="open"
        :id="`${id}-panel`"
        role="region"
        :class="ns.e('panel')"
        :aria-labelledby="`${id}-header`"
      >
        <ol :class="ns.e('list')">
          <li
            v-for="(item, index) in items"
            :key="item.key ?? index"
            :class="[ns.e('item'), ns.is(item.status ?? 'pending')]"
          >
            <span :class="ns.e('mark')">
              <template v-if="item.status === 'running'">
                <DouSpinner v-if="live" size="sm" :label="t('chat.stepRunning')" />
                <DouStatusDot v-else tone="primary" :label="t('chat.stepRunning')" />
              </template>
              <ClockPauseIcon
                v-else-if="item.status === 'waiting'"
                :label="t('chat.stepWaiting')"
              />
              <CheckIcon v-else-if="item.status === 'done'" :label="t('chat.stepDone')" />
              <AlertCircleIcon v-else-if="item.status === 'error'" :label="t('chat.stepError')" />
              <span v-else :class="ns.e('dot')" />
            </span>
            <span :class="ns.e('text')">
              <slot name="item" :item="item" :index="index">
                <span :class="ns.e('label')">
                  <DouShimmer :active="live && item.status === 'running'">{{
                    item.label
                  }}</DouShimmer>
                </span>
                <span v-if="item.description" :class="ns.e('description')">
                  {{ item.description }}
                </span>
              </slot>
            </span>
          </li>
        </ol>
      </div>
    </CollapseTransition>
  </div>
</template>
