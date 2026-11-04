<script setup lang="ts">
import { AlertCircleIcon, CheckIcon, ChevronDownIcon, ListChecksIcon } from '@dou-ui/icons'
import { computed, ref, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { CollapseTransition } from '../collapse/collapse-transition'
import { useLocale } from '../config-provider/use-config'
import DouShimmer from '../shimmer/shimmer.vue'
import DouSpinner from '../spinner/spinner.vue'
import type { ChatPlanEmits, ChatPlanProps, ChatPlanSlots } from './chat-plan'

defineOptions({ name: 'DouChatPlan' })

const props = withDefaults(defineProps<ChatPlanProps>(), {
  items: () => [],
  collapsible: true,
  open: undefined,
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

const finished = computed(
  () => props.items.filter((item) => item.status === 'done' || item.status === 'skipped').length,
)
const running = computed(() => props.items.some((item) => item.status === 'running'))
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
    <button
      v-if="collapsible"
      :id="`${id}-header`"
      type="button"
      :class="ns.e('header')"
      :aria-expanded="open"
      :aria-controls="`${id}-panel`"
      @click="toggle"
    >
      <ListChecksIcon :class="ns.e('icon')" />
      <span :class="ns.e('title')">{{ title ?? t('chat.plan') }}</span>
      <span :class="ns.e('count')">{{ finished }} / {{ items.length }}</span>
      <ChevronDownIcon :class="ns.e('arrow')" />
    </button>
    <div v-else :id="`${id}-header`" :class="ns.e('header')">
      <ListChecksIcon :class="ns.e('icon')" />
      <span :class="ns.e('title')">{{ title ?? t('chat.plan') }}</span>
      <span :class="ns.e('count')">{{ finished }} / {{ items.length }}</span>
    </div>
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
              <DouSpinner
                v-if="item.status === 'running'"
                size="sm"
                :label="t('chat.stepRunning')"
              />
              <CheckIcon v-else-if="item.status === 'done'" :label="t('chat.stepDone')" />
              <AlertCircleIcon v-else-if="item.status === 'error'" :label="t('chat.stepError')" />
              <span v-else :class="ns.e('dot')" />
            </span>
            <span :class="ns.e('text')">
              <slot name="item" :item="item" :index="index">
                <span :class="ns.e('label')">
                  <DouShimmer :active="item.status === 'running'">{{ item.label }}</DouShimmer>
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
